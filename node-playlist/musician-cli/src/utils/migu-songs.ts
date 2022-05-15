import * as fse from 'fs-extra'
import fetch from 'node-fetch'
import * as path from 'node:path'
import {ISong, SearchResponse} from '../types'

export const searchSong = async (
  keyword: string,
  page = 1,
  pageSize = 10,
): Promise<SearchResponse> => {
  const searchUrl = `https://pd.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do?ua=Android_migu&text=${keyword}&pageNo=${page}&pageSize=${pageSize}&searchSwitch={song:1}`

  return fetch(searchUrl).then<SearchResponse>(r => r.json())
}

export const generateURL = (song: ISong): string => {
  const option = song.newRateFormats[song.newRateFormats.length - 1]
  const {pathname} = new URL(option.androidUrl)

  return `https://freetyst.nf.migu.cn${pathname}`
}

export const generateURL2 = (song: ISong, SQ = false): string => {
  const url = new URL(
    'http://app.pd.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do?toneFlag=HQ&netType=00&userId=15548614588710179085069&ua=Android_migu&version=5.1&copyrightId=0&channel=0',
  )

  url.searchParams.set('contentId', song.contentId)
  if (SQ) {
    url.searchParams.set('formatType', 'SQ')
    url.searchParams.set('resourceType', 'E')
  } else {
    url.searchParams.set('formatType', 'HQ')
    url.searchParams.set('resourceType', '2')
  }

  return url.toString()
}

export const downloadSong = async (
  song: ISong,
  url: string,
  destinationFolder: string,
): Promise<string> => {
  fse.ensureDir(destinationFolder)

  const destination = path.resolve(
    destinationFolder,
    `${song.singers[0].name}-${song.name}.mp3`,
  )
  const destination$ = fse.createWriteStream(destination);
  (await fetch(url)).body.pipe(destination$)
  return new Promise<string>((resolve, reject) => {
    destination$.on('close', () => {
      resolve(destination)
    })
    destination$.on('error', e => {
      reject(e)
    })
  })
}
