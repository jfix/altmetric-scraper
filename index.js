require('dotenv').config({path: '_env'})
const cheerio = require('cheerio')
const fs = require('fs')
const moment = require('moment')
const puppeteer = require('puppeteer')
const striptags = require('striptags')

let results = []
const toDate = moment().subtract(1, 'days') // if this is run around midnight ...
const fromDate = toDate.clone() //.subtract(1, 'days')
const loginUrl = process.env.LOGIN_URL
const jsonUrl = `${process.env.JSON_URL}?mentioned_after=${fromDate.format('YYYY-MM-DD')}&mentioned_before=${toDate.format('YYYY-MM-DD')}`
let pageNumber = 1
let page
let browser
console.log(`-- DATES: ${fromDate.format('YYYY-MM-DD')} - ${toDate.format('YYYY-MM-DD')}`);

// shit starts here

(async () => {
  // get JSON content
  const getJson = async (pageNumber) => {
    console.log(`-- RETRIEVING ${jsonUrl}&page=${pageNumber} ...`)
    await page.goto(`${jsonUrl}&page=${pageNumber}`)
    const jsonContent = await page.content()
    if (!jsonContent) {
      console.log(`-- NO JSON CONTENT FOUND`)
      return false
    }
    const $ = await cheerio.load(jsonContent)
    const json = await JSON.parse($('pre').text())
    const items = json.data[0][1]
    console.log(`SOME JSON: ${JSON.stringify(items).substring(0, 200)}`)
    results = results.concat(items)
    console.log(`-- RESULTS HAS NOW ${results.length} ITEMS`)
    return !json.lastPage
  }

  // create an HTML file that will later be converted to PDF
  const createHTMLFile = async (items) => {
    const from = fromDate.format('MMMM D, YYYY')
    //const to = toDate.format('D MMM YYYY')
    let mentionsList = ''
    // items.reverse()
    items.sort((a, b) => {
      const date1 = new Date(a.postedAt)
      const date2 = new Date(b.postedAt)
      if (date1 > date2){
        return 1
      } else {
        return -1
      }
    })
    items.forEach((item) => {
      console.log(`DATE: ${item.postedAt}.`)
      let type = ''
      switch (item.postType) {
        case 'tweet': type = 'Tweet by'; break
        case 'msm': type = 'News story by'; break
        case 'wikipedia': type = 'Wikipedia citation'; break
        case 'blog': type = 'Blog entry by'; break
        default: type = 'Mention'
      }
      mentionsList = mentionsList + `<li>
      <div>
      <a href='${process.env.ALTMETRIC_DETAILS_URL}=${item.outputs[0].id}'>
      <div class="fake-badge">
      ${item.outputs[0].score || '?'}
      </div>
      </a>
      <div>
      ${moment(item.postedAt).format('HH:mm')}
      <em>${type}</em>
      <strong>${item.profileName || ''}</strong>:
      ${item.title ? item.title + ' - ' : ''}
      <a href='${item.url}'>
        ${item.body && item.body.length > 500
          ? striptags(item.body).substring(0, 400) + ' ...'
          : item.body}
      </a> -
       Mentions the ${item.outputs[0].outputType} <a href='${process.env.ALTMETRIC_DETAILS_URL}=${item.outputs[0].id}'>
       ${item.outputs[0].title}</a>

       ${item.outputs[0].pubdate ? 'published ' + moment(item.outputs[0].pubdate).format('D MMM YYYY') : ''}
       </div>
       </div>
      </li>`
    })
    console.log(`-- GENERATED HTML`)
    return `<html>
<head>
<style type='text/css'>
.fake-badge {
  width: 40px;
  height:  40px;
  float: right;
  background-color: lightblue;
  color: #ffffff;
  font-weight: bold;
  font-size: 18px;
  border-radius: 20px;
  text-align: center;
  line-height: 40px;
  text-indent: 0;
  margin-left: 0;
}
ol {
  list-style-type: none;
}
li {
  padding-bottom: 0.5em;
  text-indent: -3em; margin-left: 3em;
}
body {
  font-size: smaller;
  font-family: Arial, Helvetica, sans-serif;
}
p.intro {
  color: #A9A9A9;
}
</style>
</head>
<body><h1>${items.length} mentions of OECD publications in social media for ${from}</h1>
<p class='intro'>This list is compiled daily from <a href='https://www.altmetric.com/'>Altmetric data</a>
and is based on mentions of <a href='https://en.wikipedia.org/wiki/Digital_object_identifier'>DOIs</a> in
Social Media. 'Social Media' in this context includes Tweets, Blog entries, News stories and sometimes even
Wikipedia edits. The blue circle next to each mention indicates the number of times the respective publications
was shared on Social Media. Clicking on it will provide further details. This list was generated at
${moment().format('H:mm')} on ${moment().format('D MMMM YYYY')}.</p>

<ol>
  ${mentionsList}
</ol>

</body>
</html>`
  }

  const saveJson = async (json) => {
    const fileName = `./data/mentions-${fromDate.format('YYYY-MM-DD')}.json`
    await fs.writeFile(fileName, JSON.stringify(json, {}, 2), (err) => {
      if (err) throw new Error()
      console.log(`-- SAVED ${fileName}.`)
    })
  }


  const saveAsHTML = async (fileContents) => {
    const fileName = `./data/mentions-${fromDate.format('YYYY-MM-DD')}.html`
    const newPage = await browser.newPage()
    await newPage.setContent(fileContents)
    await fs.writeFile(fileName, fileContents, (err) => {
      if (err) throw new Error()
      console.log(`-- SAVE ${fileName}`)
    })
  }

  const saveAsPDF = async (fileContents) => {
    const fileName = `./data/mentions-${fromDate.format('YYYY-MM-DD')}.pdf`
    const newPage = await browser.newPage()
    await newPage.setContent(fileContents)
    await newPage.pdf({
      printBackground: true,
      path: fileName,
      format: 'A4',
      margin: {
        top: '1.5cm',
        right: '1cm',
        bottom: '1.5cm',
        left: '2.5cm'
      }
    })
  }

  // launch the process
  browser = await puppeteer.launch({
    // headless: true,
    // slowMo: 50
  })
  page = await browser.newPage()
  await page.goto(loginUrl)
  // LOGIN
  console.log('-- ON LOGIN PAGE')
  await page.type('#email', process.env.LOGIN, {delay: 5})
  await page.type('#password', process.env.PASSWORD, {delay: 5})
  await Promise.all([
    page.click('input[type=submit]'),
    page.waitForNavigation()
  ])
  console.log('-- LOGGED IN')

  // COLLECT MENTIONS
  while (true) {
    console.log('-- NOW SCRAPING ...')
    const nextPage = await getJson(pageNumber)
    if (!nextPage) break
    else pageNumber = pageNumber + 1
  }
  console.log(`-- BEFORE SAVE: RESULTS NOW HAS ${results.length} ITEMS`)
  const fileContents = await createHTMLFile(results)
  await saveJson(results)
  await saveAsHTML(fileContents)
  await saveAsPDF(fileContents)
  await browser.close()
})()
