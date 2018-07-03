Process description

using puppeteer
* attempt to login (test whether we're already logged in)

using puppeteer page.goto()
* then get first json_data page (use mentioned_after and mentioned_before)
* add all objects in the array inside the data object to results
* check for presence of "lastPage": true (or false)
* get next page if not lastPage

using puppeteer
* create a new page
* loop over results array
* dump data into the page that gets saved locally (or not)
* https://stackoverflow.com/questions/47587352/opening-local-html-file-using-puppeteer
* save generated HTML page as PDF (not rocket science https://gist.github.com/adisetiawan/29ba2bab10ed85706f8b1d1a8eceb825)
