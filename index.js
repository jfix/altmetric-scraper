require('dotenv').config({path: '_env'})
const puppeteer = require('puppeteer')
const moment = require('moment')
const cheerio = require('cheerio')
const fs = require('fs')

const results = []
const toDate = moment().subtract(1, 'days') // if this is run around midnight ...
const fromDate = toDate.clone().subtract(2, 'days')
const url = `${process.env.URL}?mentioned_after=${fromDate.format('YYYY-MM-DD')}&mentioned_before=${toDate.format('YYYY-MM-DD')}`
console.log(`-- DATES: ${fromDate.format('YYYY-MM-DD')} - ${toDate.format('YYYY-MM-DD')}`);

(async () => {
  const scrape = async () => {
    // GET ALL MENTIONS
    const content = await page.content()
    let $
    if (content && content.length > 0) {
      console.log(`-- GOT CONTENT ...`)
      $ = cheerio.load(content)
    } else {
      console.log(`-- NO CONTENT?!`)
    }
    const items = $('div.Mentions-Post')
    console.log(`-- ${items.length} ITEMS FOUND.`)
    items.each(function (i, elt) {
      const datetime = $('div.timestamp time', $(this)).attr('datetime')
      // div.post-content div.title
      const title = $('div.post-content div.title', $(this)).text()
      const sourceName = $('div.source span', $(this)).text()
      const tweetLink = $('div.post-content a', $(this)).attr('href')
      const abstract = $('div.abstract', $(this)).text()
      const pubTitle = $('div.output-content a.Mentions-Output span.main', $(this)).text()
      const pubSource = $('div.output-content a.Mentions-Output span.source span', $(this)).text()
      const result = {
        datetime,
        sourceName,
        tweetLink,
        abstract,
        pubTitle,
        pubSource
      }
      if (title.length > 0) result.title = title
      results.push(result)
    })
  }
  const navigateToNextPage = async () => {
    // ATTEMPT TO NAVIGATE TO NEXT PAGE
    console.log('-- NEXT PAGE ...?')
    const nextPage = await page.$('a.next')
    if (nextPage) {
      console.log('-- THERE IS ONE!')
      await nextPage.click()
      await page.waitForNavigation()
      // await page.waitForXPath('//a.previous[2]')
      return true
    } else {
      console.log('-- NO NEXT PAGE FOUND.')
      return false
    }
  }

  const browser = await puppeteer.launch({
    // headless: false
    // slowMo: 50
  })
  const page = await browser.newPage()
  await page.goto(url)
  console.log('-- ON LOGIN PAGE')
  // LOGIN
  await page.type('#email', process.env.LOGIN, {delay: 5})
  await page.type('#password', process.env.PASSWORD, {delay: 5})
  await Promise.all([
    page.click('input[type=submit]'),
    page.waitForNavigation()
  ])
  console.log('-- LOGGED IN')

  // TODO: CHECK THAT THERE IS CONTENT AT ALL!

  // GET MENTIONS
  while (true) {
    console.log('-- NOW SCRAPING ...')
    await scrape()
    const nextPage = await navigateToNextPage()
    console.log(`-- AFTER navigateToNextPage: ${nextPage}`)
    if (!nextPage) break
  }
  console.log(`-- BEFORE SAVE: RESULTS NOW HAS ${results.length} ITEMS`)
  fs.writeFile('data.json', JSON.stringify(results), (err) => {
    if (err) throw new Error()
    console.log(`-- SAVED data.json successfully.`)
  })
  await browser.close()
})()
