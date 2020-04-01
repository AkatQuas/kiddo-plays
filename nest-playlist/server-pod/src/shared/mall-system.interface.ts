
export interface Mall {
  id: string;
  name: string;
  site_id: string;
  address?: string;
  province_name?: string;
  county_name?: string;
  city_name?: string;
  category_group_id?: string;
  model?: {
    state?: number;
    bundle?: string;
    url?: string;
  }
}
