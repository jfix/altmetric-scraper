require('dotenv').config({path: '_env'})
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 500
  })
  const page = await browser.newPage()
  await page.goto(process.env.URL)

  await page.type('#email', process.env.LOGIN, {delay: 200})
  await page.type('#password', process.env.PASSWORD, {delay: 200})
  await page.click('input[type=submit]')
  await page.screenshot({path: 'example.png'})

  await browser.close()
})()
