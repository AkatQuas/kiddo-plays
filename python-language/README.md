# Overview

A playground on Python(^3.6).

# Notes

- Proxy pools
- Use-Agent
- Set-Cookie
- Referer

# code practise

- store the crawling urls in a set, leave out the repeated ones
- create a queue and a crawled list, save the time for no repeating crawling
- create multiple threads to crawl at the same time


# Useful libraries

- [urllib](https://docs.python.org/3.6/library/urllib.html), built-in library for working with `url`
- [urllib3](https://urllib3.readthedocs.io/en/latest/), 3rd-party library, an advanced `urllib`, `requests` use `urllib3`
- [requests](http://docs.python-requests.org/en/master/), a powerful HTTP Request library.
- [html.parser](https://docs.python.org/3/library/html.parser.html), built-in library for html parsing

- [numpy](http://www.numpy.org/) for matrix-like calculating, as well as some random and distribution methods
- [scipy](https://www.scipy.org/) for powerful math calculation, linear algebra, optimisation, statistic, etc
- [matplotlib](http://matplotlib.org/) for ploting
- [sympy](http://www.sympy.org/en/index.html) for symbolic computation, useful in calculating explicit solutions to equations, integrations, etc.

# Tricks

```python
# a fast way to read from file, with low memory cost, without error exception
for line in open('script1.py'):
     # do something with line

# List Comprehensions
list2 = [ x**2 for x in list1 ]
```
