
export interface CheckoutConfig {
  id: number;
  name: string;
  slug: string;
  display_logo_text: number;
  display_logo_flag: number;
  logotipo: string;
  favicon: string;
  order_bumps_enabled: number;
  order_bump_message: string;
  timer_enabled: number;
  timer_message: string;
  timer_duration: string | number | null;
  coupons_enabled: number;
  banners_enabled: number;
  banner_image: string;
  marquee_enabled: number;
  marquee_text: string | null;
  sales_counter_enabled: number;
  sales_message: string;
  sales_min: number;
  sales_max: number;
  reviews_enabled: number;
  reviews: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  custom_css?: string;
  custom_header?: string;
  custom_footer?: string;
}

export interface PriceTier {
  from: number;
  to: number;
  price: string;
}

export interface ServiceConfig {
  mode: 'credits' | 'packages';
  credit_base_price?: string;
  min_credits?: string | number;
  max_credits?: string | number;
  price_tiers?: string | PriceTier[];
  [key: string]: any;
}

export interface Product {
  id: number;
  product_id: number;
  product_name: string;
  description: string;
  price: string;
  final_price: string;
  image: string;
  allow_quantity_selection?: number;
  quantity_limit?: number | null;
  product_type?: string;
  service_type?: string;
  service_config?: string | null;
}

export interface OrderBump {
  id: number;
  product_id: number;
  product_name: string;
  description: string;
  price: string;
  final_price: string;
  image: string;
  specific_products: string; // JSON string of products
  allow_quantity_selection: number;
  quantity_limit: number | null;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
}

export interface PaymentMethod {
  id: number;
  payment_methods: 'pix' | 'boleto' | 'credit_card';
  discount_percentage: string | null;
  installment_fee?: string | null;
  tag: string;
  enable_client_side?: number;
  config?: any;
}

export interface CheckoutData {
  checkout: CheckoutConfig;
  products: Product[];
  orderbumps: OrderBump[];
  coupons: Coupon[];
  payment_methods: PaymentMethod[];
}

export interface CountryDDI {
  code: string;
  flag: string;
  name: string;
}

export interface ReviewItem {
  name: string;
  rating: number;
  text: string;
  date: string;
  avatar: string;
}

export interface ReviewsData {
  config: {
    title: string;
    subtitle: string;
    display_mode: string;
    star_color: string;
    background_color: string;
    text_color: string;
  };
  items: ReviewItem[];
}
