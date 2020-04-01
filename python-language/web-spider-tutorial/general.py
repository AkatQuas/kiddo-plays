# -*- coding: utf-8 -*-

'project boilerplate'
import os
import warnings

# Each project for crawler is a separate project with folder


def create_project_dir(directory):
    '''
        create a project folder for crawler
        @directory: project name
    '''
    if not os.path.exists(directory):
        print('Creating project: ' + directory)
        os.makedirs(directory)
    else:
        print(directory + 'exists, skip it')


def create_data_files(project_name, base_url):
    '''
     creat a queue of tasks to crawl
    '''
    queue = project_name + '/queue.txt'
    crawled = project_name + '/crawled.txt'

    if not os.path.isfile(queue):
        write_file(queue, base_url)

    if not os.path.isfile(crawled):
        write_file(crawled)


def write_file(path, data=''):
    '''
        write data to file
        @path: the file path
        @data: the data to be written, default is empty string
    '''
    with open(path, 'w') as f:
        f.write(data)


def append_to_file(path, data):
    '''
        append data to existing file
        @path: the file path
        @data: the data to be written, can not be empty string 
    '''
    if not data:
        return warnings.warn('can not append empty to file')
    with open(path, 'a') as f:
        f.write(data + '\n')


def delete_file_contents(path):
    '''
        clear the content in the file
        @path: the file path
    '''
    with open(path, 'w'):
        pass


def file_to_set(path):
    '''
        read a file, convert each line to items in a set
        @path: file path
    '''
    results = set()
    with open(path, 'rt') as f:
        for line in f:
            results.add(line.replace('\n',''))
    return results

def set_to_file(links, path):
    delete_file_contents(path)
    for link in sorted(links):
        append_to_file(path, link) 
