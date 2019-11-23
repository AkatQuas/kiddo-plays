import requests
import re



def main():
    pattern = re.compile(r'<div.*?author.*?><a.*?<img.*?<h2>(.+?)<\/h2>.*?<a.*?<div.*?class="content"><span>(.+?)<\/span>.*?class="stats">.*?<\/a>',re.S)
    page = 1
    url = 'https://www.qiushibaike.com/hot/page/' + str(page)
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36'}
    r = requests.get(url,headers=headers).text
    # print(r)
    r = re.sub(r'(<br\/>+|\n+)','',r)
    # return print(r)
    items = re.findall(pattern, r)
    # return print(items)
    for (au,te) in items:
        print(au, '$', te)

if __name__ == '__main__':
    main()