require('dotenv').config({path: '_env'})
const puppeteer = require('puppeteer')
const moment = require('moment')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

let results = []
const toDate = moment().subtract(1, 'days') // if this is run around midnight ...
const fromDate = toDate.clone().subtract(1, 'days')
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
    const from = fromDate.format('D MMM')
    const to = toDate.format('D MMM YYYY')
    let mentionsList = ''
    items.reverse()
    items.forEach((item) => {
      let type = ''
      switch (item.postType) {
        case 'tweet': type = 'Tweet by'; break
        case 'msm': type = 'News story by'; break
        case 'wikipedia': type = 'Wikipedia citation'; break
        case 'blog': type = 'Blog entry by'; break
        default: type = 'Mention'
      }
      mentionsList = mentionsList + `<li>
      ${moment(item.postedAt).format('HH:mm')}
      <em>${type}</em>
      <strong>${item.profileName || ''}</strong>:
      ${item.title ? item.title + ' - ' : ''}
      <a href='${item.url}'>${item.body && item.body.length > 500
    ? item.body.substring(0, 400) + ' ...'
    : item.body}</a> -
       Mentions the ${item.outputs[0].outputType} <a href='${process.env.ALTMETRIC_DETAILS_URL}=${item.outputs[0].id}'>
       ${item.outputs[0].title}</a>

       ${item.outputs[0].pubdate ? 'published ' + moment(item.outputs[0].pubdate).format('D MMM YYYY') : ''}
      </li>`
    })
    console.log(`-- GENERATED HTML`)
    return `<html>
<head><style type='text/css'>
ol {
  list-style-type: none;
}
li {
  padding-bottom: 0.5em;
  text-indent: -3em; margin-left: 3em;
}
body {
  font-size: smaller;
}
</style></head>
<body><h1>${items.length} mentions for the period of ${from} to ${to}</h1>
<ol>
  ${mentionsList}
</ol>
</body></html>`
  }

  const saveAsPDF = async (fileName) => {
    page = await browser.newPage()
    const pathName = `file://${path.join(__dirname, fileName)}`
    console.log(`-- OPENING: ${pathName}`)
    const res = await page.goto(pathName, {
      waitUntil: 'networkidle0'
    })
    if (!res) {
      console.log(`-- ERROR WHILE LOADING LOCAL FILE`)
    }
    console.log(`-- NOW ATTEMPTING TO SAVE PDF to file://${path.join(__dirname, 'mentions.pdf')}`)
    await page.pdf({
      path: `file:${path.join(__dirname, 'mentions.pdf')}`,
      format: 'A4'
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
  fs.writeFile('mentions.html', fileContents, async (err) => {
    if (err) throw new Error()
    console.log(`-- SAVED mentions.html successfully.`)
    await saveAsPDF('mentions.html')
  })
  await browser.close()
})()
