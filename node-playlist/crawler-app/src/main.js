const puppeteer = require('puppeteer');
const url = require('url')

async function run(targetURL) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage().then(page => {
    page.setViewport({
      width: 1280,
      height: 960
    })
    return page
  }).catch(err => {
    console.log(err)
  });

  let next = ''
  page.on('console', msg => console.log('PAGE LOG:', ...msg.args));
  let nowURL = targetURL.href
  let i = 0
  let imageURL = []

  while (i < 2) {
    await page.goto(nowURL)
    console.log(i)
    imageURL[i] = await page.evaluate(_ => {
      const elements = [...document.querySelectorAll('a.view_img_link')]
      return elements.map(el => {
        return el.href
      })
    })
    nowURL = await page.evaluate(_ => { 
      const nextPATH = document.querySelector('a.previous-comment-page').href
      return nextPATH
    })
    i++
    console.log(nowURL)
  }
  console.log('finally', imageURL)

  await browser.close();
};

const res = url.parse('http://jandan.net/ooxx/page-247#comments', true, true)
run(res)