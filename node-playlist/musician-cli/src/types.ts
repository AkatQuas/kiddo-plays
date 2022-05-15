// 无损 formatType=SQ resourceType=E
// 高品 formatType=HQ resourceType=2
export type INewRateFormat = {
  resourceType: string;
  formatType: string;
  iosUrl: string;
  iosFormat: string;
  iosNewFormat: string;
  iosFileType: string;
  androidUrl: string;
  androidFormat: string;
  androidNewFormat: string;
  androidFileType: string;
  size: string;
  fileType: string;
  price: string;
};

export interface ISong {
  id: string;
  resourceType: string;
  contentId: string;
  copyrightId: string;
  name: string;
  highlightStr: string[];
  singers: Array<{ id: string; name: string }>;
  albums: unknown[];
  lyricUrl: string;
  trcUrl: string;
  imgItems: unknown[];
  televisionNames: string[];
  tones: unknown[];
  relatedSongs: unknown[];
  toneControl: string;
  rateFormats: unknown[];
  newRateFormats: INewRateFormat[];
  songType: string;
  isInDAlbum: string;
  copyright: string;
  digitalColumnId: string;
  mrcurl: string;
  songDescs: string;
  songAliasName: string;
  invalidateDate: string;
  isInSalesPeriod: string;
  dalbumId: string;
  isInSideDalbum: string;
  vipType: string;
  chargeAuditions: string;
  scopeOfcopyright: string;
  [key: string]: unknown;
}
export interface SearchResponse {
  code: string;
  info: string;
  songResultData: {
    totalCount: string;
    correct: unknown[];
    resultType: string;
    isFromCache: string;
    tipStatus: string;
    result: ISong[];
  };
  bestShowResultToneData: unknown;
}
