export interface Weapp {
  id: string;
  modules?: Object;
  mall_id: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  weapp: string;
  config: {
    title: string;
    content?: string;
    img_src?: string;
    link?: string;
    associated?: {
      floors?: string[];
      shops?: string[];
      show_in_navi?: boolean;
      [key: string]: any
    };
  };
  start_time: Date;
  end_time: Date;
}
