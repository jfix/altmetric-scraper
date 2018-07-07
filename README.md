# Goal of the script

Scrape information from Altmetric Explorer site (requires an account) by using the JSON data the site uses internally for displaying the information.

Then, create a new HTML page and save this as a PDF. Because this is what the business wants, apparently.

## How it works behind the scenes

Using puppeteer

* attempt to login (test whether we're already logged in)

Using puppeteer `page.goto()`

* then get first json_data page (use mentioned_after and mentioned_before)
* add all objects in the array inside the data object to results
* check for presence of "lastPage": true (or false)
* get next page if not lastPage

Using puppeteer `page.setContent` and `page.pdf`

* create a new page
* loop over results array
* dump data into that page HTML
* save generated HTML page as PDF
