import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, 
  ChevronRight, 
  ShoppingCart, 
  CreditCard as CardIcon, 
  Clock,
  User,
  Tag,
  ChevronDown,
  Info,
  FileText,
  Lock,
  Zap,
  Check,
  Star,
  Users,
  MessageCircle,
  CreditCard as CardSvg,
  Minus,
  Plus,
  X,
  AlertCircle,
  Loader2,
  TrendingUp,
  Coins
} from 'lucide-react';
import { CheckoutData, OrderBump, Coupon, ReviewsData, ReviewItem, PaymentMethod, Product, ServiceConfig, PriceTier } from './types';
import { COUNTRIES } from './constants';

declare global {
  interface Window {
    mercadoPagoConfig?: any;
    pagseguroConfig?: any;
    iuguConfig?: any;
    PagSeguro?: any;
    Iugu?: any;
    MercadoPago?: any;
  }
}

const PixIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" fill="currentColor" className={className} viewBox="0 0 16 16">
    <path d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z"></path>
    <path d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z"></path>
  </svg>
);

// Função para obter o slug da URL
const getSlugFromUrl = (): string => {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'HubTV';
};

// Construir API URL dinamicamente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://paglink.net/api/checkout';
const CHECKOUT_SLUG = getSlugFromUrl();
const API_URL = `${API_BASE_URL}/${CHECKOUT_SLUG}`;

const App: React.FC = () => {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productQuantity, setProductQuantity] = useState<number>(1);
  const [selectedBumps, setSelectedBumps] = useState<Record<number, number>>({});
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [form, setForm] = useState({ name: '', email: '', cpf: '', ddi: '+55', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [cardForm, setCardForm] = useState({
    number: '',
    name: '',
    expiry: '',
    cvc: '',
    installments: '1'
  });
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState<Record<string, boolean>>({});
  
  const [isDdiOpen, setIsDdiOpen] = useState(false);
  const ddiRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Helper to check if feature is enabled
  const isEnabled = (value: number | string | boolean | undefined | null): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
    return false;
  };

  // Helper to format currency
  const formatCurrency = (value: number | string) => {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    return val.toFixed(2).replace('.', ',');
  };

  // Helper to parse service config
  const parseServiceConfig = (configStr: string | null | undefined): ServiceConfig | null => {
    if (!configStr) return null;
    try {
      const config = JSON.parse(configStr);
      if (typeof config.price_tiers === 'string') {
        config.price_tiers = JSON.parse(config.price_tiers);
      }
      return config;
    } catch (e) {
      console.error('Failed to parse service_config', e);
      return null;
    }
  };

  // Helper to get unit price based on tiers
  const getUnitPrice = (product: Product, quantity: number) => {
    const config = parseServiceConfig(product.service_config);
    if (!config || config.mode !== 'credits') return parseFloat(product.final_price);

    const basePrice = parseFloat(config.credit_base_price || product.final_price);
    const tiers = (config.price_tiers as PriceTier[]) || [];
    
    const matchedTier = tiers.find(tier => quantity >= tier.from && (tier.to === 0 || quantity <= tier.to));
    
    return matchedTier ? parseFloat(matchedTier.price) : basePrice;
  };

  // Fetch Data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('🚀 Fetching from:', API_URL);
        const response = await fetch(API_URL);
        const json = await response.json();
        
        if (json.success && json.data) {
          console.log('✅ Data loaded successfully:', json.data);
          setData(json.data);
          if (json.data.products && json.data.products.length > 0) {
            const firstProduct = json.data.products[0];
            setSelectedProductId(firstProduct.id);
            const config = parseServiceConfig(firstProduct.service_config);
            if (config && config.mode === 'credits') {
              setProductQuantity(parseInt(String(config.min_credits)) || 1);
            }
          }
          if (json.data.payment_methods && json.data.payment_methods.length > 0) {
            setPaymentMethod(json.data.payment_methods[0].payment_methods);
          }
        } else {
          setError('Não foi possível carregar os dados do checkout.');
        }
      } catch (err) {
        setError('Erro de conexão com o servidor.');
        console.error('❌ Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // SDK Loading
  useEffect(() => {
    if (!data) return;
    data.payment_methods.forEach((pm: PaymentMethod) => {
      if (pm.payment_methods === 'credit_card' && isEnabled(pm.enable_client_side)) {
        const config = pm.config || {};
        switch (pm.tag) {
          case 'mercadopago':
            window.mercadoPagoConfig = { publicKey: config.public_key, paymentMethodId: pm.id };
            loadScript('https://sdk.mercadopago.com/js/v2', 'mp-sdk');
            break;
          case 'pagseguro':
            window.pagseguroConfig = { publicKey: config.public_key, environment: config.environment || 'sandbox', paymentMethodId: pm.id };
            loadScript('https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js', 'ps-sdk');
            break;
          case 'iugu':
            window.iuguConfig = { accountId: config.account_id, testMode: String(config.test_mode) === "true", paymentMethodId: pm.id };
            loadScript('https://js.iugu.com/v2', 'iugu-sdk');
            break;
        }
      }
    });
  }, [data]);

  const loadScript = (src: string, id: string) => {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.async = true;
    script.onload = () => setSdkLoaded(prev => ({ ...prev, [id]: true }));
    document.head.appendChild(script);
  };

  // Parsing Timer
  const initialSeconds = useMemo(() => {
    if (!data) return 900;
    const duration = data.checkout.timer_duration;
    if (!duration) return 900;
    if (typeof duration === 'number') return duration;
    const parts = String(duration).split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 900;
  }, [data]);

  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (initialSeconds) setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  // Parsing Reviews
  const reviewsData: ReviewsData | null = useMemo(() => {
    if (!data || !isEnabled(data.checkout.reviews_enabled) || !data.checkout.reviews) return null;
    try {
      return JSON.parse(data.checkout.reviews);
    } catch (e) {
      return null;
    }
  }, [data]);

  // Dynamic Sales Counter
  const [salesCount, setSalesCount] = useState(0);
  useEffect(() => {
    if (!data || !isEnabled(data.checkout.sales_counter_enabled)) return;
    setSalesCount(data.checkout.sales_min);
    const interval = setInterval(() => {
      setSalesCount(prev => {
        const delta = Math.floor(Math.random() * 3) - 1;
        const next = prev + delta;
        if (next < data.checkout.sales_min) return data.checkout.sales_min;
        if (next > data.checkout.sales_max) return data.checkout.sales_max;
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ddiRef.current && !ddiRef.current.contains(event.target as Node)) {
        setIsDdiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [data, timeLeft]);

  const getImageUrl = (path: string, type: 'banner' | 'product' | 'logo' | 'favicon' | 'review' = 'product') => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = 'https://paglink.net/public/uploads';
    switch (type) {
      case 'banner': return `${base}/checkouts/banners/${path}`;
      case 'product': return `${base}/products/${path}`;
      case 'logo': return `${base}/checkouts/logos/${path}`;
      case 'favicon': return `${base}/checkouts/${path}`;
      case 'review': return `${base}/reviews/${path}`;
      default: return `${base}/products/${path}`;
    }
  };

  const applyPhoneMask = (value: string, ddi: string) => {
    const numbers = value.replace(/\D/g, '');
    if (ddi === '+55') {
      if (numbers.length <= 10) {
        return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '').trim();
      } else {
        return numbers.slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      }
    }
    return numbers.slice(0, 15);
  };

  const applyDocumentMask = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .slice(0, 14);
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})/, '$1-$2')
        .slice(0, 18);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value, form.ddi);
    setForm(prev => ({ ...prev, phone: masked }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyDocumentMask(e.target.value);
    setForm(prev => ({ ...prev, cpf: masked }));
    if (errors.cpf) setErrors(prev => ({ ...prev, cpf: '' }));
  };

  const detectCardBrand = (number: string) => {
    const cleanNumber = number.replace(/\s/g, '');
    if (/^4/.test(cleanNumber)) return 'visa';
    if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'amex';
    if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
    if (/^(606282|3841)/.test(cleanNumber)) return 'hipercard';
    if (/^(401178|401179|431274|438935|451416|457393|457631|457632|504175|627780|636297|636368|650031|650032|650033|650035|650036|650037|650038|650039|650040|650041|650042|650043|650044|650045|650046|650047|650048|650049|650050|650051|650405|650406|650407|650408|650409|650410|650411|650412|650413|650414|650415|650416|650417|650418|650419|650420|650421|650422|650423|650424|650425|650426|650427|650428|650429|650430|650431|650432|650433|650434|650435|650436|650437|650438|650439|650485|650486|650487|650488|650489|650500|650501|650502|650503|650504|650505|650506|650507|650508|650509|650510|650511|650512|650513|650514|650515|650516|650517|650518|650519|650520|650521|650522|650523|650524|650525|650526|650527|650528|650529|650530|650531|650532|650533|650534|650535|650536|650537|650538|650541|650542|650543|650544|650545|650546|650547|650548|650549|650598|650700|650701|650702|650703|650704|650705|650706|650707|650708|650709|650710|650711|650712|650713|650714|650715|650716|650717|650718|650719|650720|650721|650722|650723|650724|650725|650726|650727|650901|650902|650903|650904|650905|650906|650907|650908|650909|650910|650911|650912|650913|650914|650915|650916|650917|650918|650919|650920|651652|651653|651654|655000|655001)/.test(cleanNumber)) return 'elo';
    return null;
  };

  const getBrandIcon = (brand: string | null) => {
    if (!brand) return null;
    const base = 'https://img.icons8.com/color/48/000000/';
    switch (brand) {
      case 'visa': return `${base}visa.png`;
      case 'mastercard': return `${base}mastercard.png`;
      case 'amex': return `${base}amex.png`;
      case 'discover': return `${base}discover.png`;
      case 'hipercard': return 'https://logos-world.net/wp-content/uploads/2020/11/Hipercard-Logo.png';
      case 'elo': return 'https://www.idinheiro.com.br/wp-content/uploads/2021/05/logo-elo.png';
      default: return null;
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 16);
    const brand = detectCardBrand(value);
    setCardBrand(brand);
    const masked = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardForm(prev => ({ ...prev, number: masked }));
    if (errors.card_number) setErrors(prev => ({ ...prev, card_number: '' }));
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    const masked = value.replace(/(\d{2})(?=\d)/g, '$1/');
    setCardForm(prev => ({ ...prev, expiry: masked }));
    if (errors.card_expiry) setErrors(prev => ({ ...prev, card_expiry: '' }));
  };

  const handleCardCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardForm(prev => ({ ...prev, cvc: value }));
    if (errors.card_cvc) setErrors(prev => ({ ...prev, card_cvc: '' }));
  };

  const selectedCountry = useMemo(() => COUNTRIES.find(c => c.code === form.ddi) || COUNTRIES[0], [form.ddi]);

  const selectedProduct = useMemo(() => {
    if (!data) return null;
    return data.products.find(p => p.id === selectedProductId) || data.products[0];
  }, [selectedProductId, data]);

  const currentUnitPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    return getUnitPrice(selectedProduct, productQuantity);
  }, [selectedProduct, productQuantity]);

  const availableBumps = useMemo(() => {
    if (!data || !selectedProduct) return [];
    return data.orderbumps.filter(bump => {
      try {
        const specs = JSON.parse(bump.specific_products);
        return specs.some((s: any) => String(s.id) === String(selectedProduct.product_id));
      } catch { return true; }
    });
  }, [selectedProduct, data]);

  useEffect(() => {
    if (!data) return;
    document.documentElement.style.setProperty('--primary-color', data.checkout.primary_color);
    document.documentElement.style.setProperty('--secondary-color', data.checkout.secondary_color);
  }, [data]);

  useEffect(() => {
    if (!data || !isEnabled(data.checkout.timer_enabled) || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, data]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totals = useMemo(() => {
    if (!data || !selectedProduct) return { subtotal: 0, discount: 0, total: 0 };
    
    let base = currentUnitPrice * productQuantity;
    let bumpTotal = 0;
    Object.entries(selectedBumps).forEach(([id, qty]) => {
      const bump = data.orderbumps.find(b => b.id === Number(id));
      if (bump) bumpTotal += parseFloat(bump.final_price) * Number(qty);
    });
    
    let discount = 0;
    const pm = data.payment_methods.find(p => p.payment_methods === paymentMethod);
    if (pm?.discount_percentage) {
      discount += (base + bumpTotal) * (parseFloat(pm.discount_percentage) / 100);
    }
    if (activeCoupon) {
      const sub = base + bumpTotal;
      discount += activeCoupon.discount_type === 'percentage' 
        ? sub * (parseFloat(activeCoupon.discount_value) / 100)
        : parseFloat(activeCoupon.discount_value);
    }
    return { subtotal: base + bumpTotal, discount, total: Math.max(0, base + bumpTotal - discount) };
  }, [selectedProduct, currentUnitPrice, productQuantity, selectedBumps, activeCoupon, paymentMethod, data]);

  const handleApplyCoupon = () => {
    if (!data) return;
    const found = data.coupons.find(c => c.code.toLowerCase() === couponCode.toLowerCase());
    if (found) {
      setActiveCoupon(found);
      setErrors(prev => ({ ...prev, coupon: '' }));
    } else {
      setErrors(prev => ({ ...prev, coupon: 'Cupom inválido.' }));
    }
  };

  const removeCoupon = () => {
    setActiveCoupon(null);
    setCouponCode('');
  };

  const toggleBump = (bump: OrderBump) => {
    setSelectedBumps(prev => {
      const next = { ...prev };
      if (next[bump.id]) delete next[bump.id];
      else next[bump.id] = 1;
      return next;
    });
  };

  const updateBumpQuantity = (id: number, delta: number) => {
    if (!data) return;
    const bump = data.orderbumps.find(b => b.id === id);
    if (!bump) return;
    setSelectedBumps(prev => {
      const current = prev[id] || 1;
      const nextQty = Math.max(1, Math.min(current + delta, bump.quantity_limit || 999));
      return { ...prev, [id]: nextQty };
    });
  };

  const updateProductQuantity = (delta: number) => {
    if (!selectedProduct) return;
    const config = parseServiceConfig(selectedProduct.service_config);
    let min = 1;
    let max = selectedProduct.quantity_limit || 999;
    
    if (config && config.mode === 'credits') {
      min = parseInt(String(config.min_credits)) || 1;
      max = parseInt(String(config.max_credits)) || 100000;
    }

    setProductQuantity(prev => Math.max(min, Math.min(prev + delta, max)));
  };

  const handleProductSelection = (product: Product) => {
    if (selectedProductId === product.id) return;
    setSelectedProductId(product.id);
    const config = parseServiceConfig(product.service_config);
    if (config && config.mode === 'credits') {
      setProductQuantity(parseInt(String(config.min_credits)) || 1);
    } else if (product.allow_quantity_selection === 0) {
      setProductQuantity(1);
    } else {
      setProductQuantity(1);
    }
  };

  const getActiveGatewayName = () => {
    if (!data) return '';
    const pm = data.payment_methods.find(p => p.payment_methods === 'credit_card');
    if (!pm) return '';
    switch (pm.tag) {
      case 'mercadopago': return 'Mercado Pago';
      case 'pagseguro': return 'PagSeguro';
      case 'iugu': return 'Iugu';
      default: return pm.tag.charAt(0).toUpperCase() + pm.tag.slice(1);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nome obrigatório';
    if (!form.email.includes('@')) newErrors.email = 'E-mail inválido';
    const cleanDoc = form.cpf.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) newErrors.cpf = 'CPF/CNPJ inválido';
    if (form.phone.replace(/\D/g, '').length < 10) newErrors.phone = 'Telefone inválido';
    if (paymentMethod === 'credit_card') {
      if (!cardForm.name.trim()) newErrors.card_holder = 'Nome no cartão obrigatório';
      if (cardForm.number.replace(/\s/g, '').length < 13) newErrors.card_number = 'Número inválido';
      if (cardForm.expiry.length !== 5) newErrors.card_expiry = 'Validade inválida';
      if (cardForm.cvc.length < 3) newErrors.card_cvc = 'CVV inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendToPaymentAPI = async (orderData: any) => {
    try {
      const processUrl = `https://paglink.net/${CHECKOUT_SLUG}/process`;
      console.log('📤 Sending order to:', processUrl);
      console.log('📦 Order data:', orderData);

      const response = await fetch(processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();
      console.log('📥 Response:', result);

      if (!result.success) {
        throw new Error(result.message || 'Erro no processamento do pagamento');
      }

      return result;
    } catch (err: any) {
      console.error('❌ Payment API error:', err);
      throw err;
    }
  };

  const handleFinalize = async () => {
    if (!validate()) {
      const firstError = Object.keys(errors)[0];
      const el = document.getElementsByName(firstError)[0];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!data || !selectedProduct) return;

    setProcessing(true);

    try {
      // Preparar dados do cliente
      const customerData = {
        name: form.name,
        email: form.email,
        cpf: form.cpf.replace(/\D/g, ''),
        ddi: form.ddi,
        phone: form.phone.replace(/\D/g, '')
      };

      // Preparar itens do pedido
      const items = [];

      // Produto principal
      items.push({
        id: selectedProduct.id,
        name: selectedProduct.product_name,
        price: currentUnitPrice,
        quantity: productQuantity,
        type: 'product'
      });

      // Order bumps selecionados
      Object.entries(selectedBumps).forEach(([bumpId, quantity]) => {
        const bump = data.orderbumps.find(b => b.id === Number(bumpId));
        if (bump) {
          items.push({
            id: bump.id,
            name: bump.product_name,
            price: parseFloat(bump.final_price),
            quantity: quantity,
            type: 'orderbump'
          });
        }
      });

      // Obter payment method completo
      const selectedPaymentMethod = data.payment_methods.find(
        p => p.payment_methods === paymentMethod
      );

      if (!selectedPaymentMethod) {
        throw new Error('Método de pagamento não encontrado');
      }

      // Montar objeto de pedido
      const orderData: any = {
        customer: customerData,
        items: items,
        total: totals.total,
        coupon: activeCoupon ? activeCoupon.code : null,
        payment_method: selectedPaymentMethod.payment_methods,
        payment_method_id: selectedPaymentMethod.id
      };

      // Se for cartão de crédito, adicionar dados do cartão
      if (paymentMethod === 'credit_card') {
        orderData.card = {
          number: cardForm.number.replace(/\s/g, ''),
          holder_name: cardForm.name,
          expiry_month: cardForm.expiry.split('/')[0],
          expiry_year: '20' + cardForm.expiry.split('/')[1],
          cvv: cardForm.cvc,
          installments: parseInt(cardForm.installments)
        };
      }

      console.log('🚀 Finalizing order:', orderData);

      // Enviar para API
      const response = await sendToPaymentAPI(orderData);

      console.log('✅ Payment processed:', response);

      // Tratar resposta baseado no tipo de pagamento
      if (response.data) {
        if (paymentMethod === 'pix' && response.data.pix_code) {
          // Redirecionar para página de PIX ou mostrar QR Code
          alert(`PIX gerado com sucesso! Código: ${response.data.pix_code}`);
        } else if (paymentMethod === 'boleto' && response.data.boleto_url) {
          // Redirecionar para boleto
          window.open(response.data.boleto_url, '_blank');
        } else if (paymentMethod === 'credit_card') {
          // Redirecionar para página de sucesso
          if (response.data.redirect_url) {
            window.location.href = response.data.redirect_url;
          } else {
            alert('Pagamento aprovado com sucesso!');
          }
        }
      }

    } catch (err: any) {
      console.error('❌ Finalize error:', err);
      alert(err.message || 'Erro ao processar pagamento. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  const ErrorMsg = ({ name }: { name: string }) => errors[name] ? (
    <div className="flex items-center gap-1 mt-1.5 text-red-500 animate-in fade-in slide-in-from-top-1 duration-300">
      <AlertCircle className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-tight">{errors[name]}</span>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Carregando Checkout Seguro...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-gray-800 mb-2 uppercase tracking-tight">Ops! Algo deu errado.</h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">{error || 'Não foi possível carregar as informações do produto.'}</p>
        <button onClick={() => window.location.reload()} className="h-14 w-full max-w-[280px] bg-gray-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]">Tentar Novamente</button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen pb-40 overflow-x-hidden relative"
      style={{ backgroundColor: data.checkout.background_color, color: data.checkout.text_color }}
    >
      <div ref={headerRef} className="fixed top-0 left-0 w-full z-[100] bg-white text-black shadow-md overflow-hidden">
        <div className="flex flex-col w-full">
          <div className="h-12 flex items-center px-4 gap-3 border-b border-gray-100 bg-white">
            {isEnabled(data.checkout.display_logo_flag) && data.checkout.logotipo && (
              <img src={getImageUrl(data.checkout.logotipo, 'logo')} alt={data.checkout.name} className="h-7 w-auto object-contain shrink-0" />
            )}
            {isEnabled(data.checkout.display_logo_text) && (
              <span className="font-extrabold text-sm tracking-tight text-gray-800 uppercase truncate">{data.checkout.name}</span>
            )}
            <div className="flex-1 overflow-hidden h-full flex items-center justify-end">
              {isEnabled(data.checkout.marquee_enabled) && data.checkout.marquee_text && (
                <div className="whitespace-nowrap flex w-full">
                  <div className="flex animate-marquee shrink-0">
                    {[...Array(3)].map((_, i) => (
                      <span key={i} className="px-6 font-bold uppercase tracking-widest text-[9px] italic text-gray-400">{data.checkout.marquee_text}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {isEnabled(data.checkout.timer_enabled) && (
            <div className="bg-black text-white py-2 flex items-center justify-center gap-3 w-full">
              <div className="flex items-center gap-1.5 px-3 py-0.5 bg-red-500/20 rounded-full border border-red-500/30">
                <Clock className="w-3 h-3 text-red-500 animate-pulse" />
                <span className="text-[10px] font-black text-red-400 uppercase tracking-tighter">{data.checkout.timer_message}</span>
              </div>
              <span className="font-black text-white tabular-nums text-base">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: headerHeight }}></div>

      {isEnabled(data.checkout.banners_enabled) && data.checkout.banner_image && (
        <div className="w-full overflow-hidden block leading-[0]">
          <img src={getImageUrl(data.checkout.banner_image, 'banner')} alt="Promo Banner" className="w-full h-auto object-cover max-h-[220px]" />
        </div>
      )}

      <div className="max-w-[480px] mx-auto px-4 mt-6 space-y-6 overflow-x-hidden">
        
        {/* Seção Dados Pessoais */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/60 space-y-5 w-full box-border relative">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0"><User className="w-5 h-5" /></div>
            <h2 className="font-extrabold text-lg tracking-tight text-gray-800">Seus Dados</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nome Completo</label>
              <input name="name" type="text" placeholder="Ex: João da Silva" className={`w-full h-14 bg-gray-50 border rounded-2xl px-5 font-semibold text-gray-700 focus:bg-white transition-all outline-none text-base ${errors.name ? 'border-red-500' : 'border-gray-100'}`} value={form.name} onChange={e => { setForm({...form, name: e.target.value}); if (errors.name) setErrors({...errors, name: ''}); }} />
              <ErrorMsg name="name" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">E-mail para Acesso</label>
              <input name="email" type="email" placeholder="seuemail@exemplo.com" className={`w-full h-14 bg-gray-50 border rounded-2xl px-5 font-semibold text-gray-700 focus:bg-white transition-all outline-none text-base ${errors.email ? 'border-red-500' : 'border-gray-100'}`} value={form.email} onChange={e => { setForm({...form, email: e.target.value}); if (errors.email) setErrors({...errors, email: ''}); }} />
              <ErrorMsg name="email" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">CPF ou CNPJ</label>
              <input name="cpf" type="tel" placeholder="000.000.000-00" className={`w-full h-14 bg-gray-50 border rounded-2xl px-5 font-bold text-gray-700 focus:bg-white transition-all outline-none text-base ${errors.cpf ? 'border-red-500' : 'border-gray-100'}`} value={form.cpf} onChange={handleDocumentChange} />
              <ErrorMsg name="cpf" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">WhatsApp</label>
              <div className="grid grid-cols-[90px_1fr] gap-2 w-full">
                <div className="relative min-w-0" ref={ddiRef}>
                  <button type="button" onClick={() => setIsDdiOpen(!isDdiOpen)} className="flex items-center justify-center gap-1.5 h-14 w-full bg-gray-50 border border-gray-100 rounded-2xl px-2 font-bold text-[13px] hover:bg-white transition-all outline-none overflow-hidden shrink-0">
                    <img src={selectedCountry.flag} className="w-5 h-3.5 object-cover rounded-sm shrink-0 shadow-sm" alt="" />
                    <span className="shrink-0">{selectedCountry.code}</span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isDdiOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isDdiOpen && (
                    <div className="absolute top-16 left-0 w-[240px] bg-white border border-gray-100 rounded-2xl shadow-2xl z-[150] max-h-[280px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                      {COUNTRIES.map(country => (
                        <div key={country.code} onClick={() => { setForm({ ...form, ddi: country.code, phone: '' }); setIsDdiOpen(false); }} className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none transition-colors ${form.ddi === country.code ? 'bg-primary/5' : ''}`}>
                          <img src={country.flag} className="w-6 h-4 object-cover rounded-sm shadow-sm shrink-0" alt="" />
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[11px] font-bold text-gray-800 truncate">{country.name}</p>
                            <p className="text-[10px] text-gray-400 font-black">{country.code}</p>
                          </div>
                          {form.ddi === country.code && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <input name="phone" type="tel" placeholder={form.ddi === '+55' ? '(00) 00000-0000' : 'Telefone'} className={`w-full h-14 bg-gray-50 border rounded-2xl px-5 font-bold text-gray-700 focus:bg-white transition-all outline-none text-base ${errors.phone ? 'border-red-500' : 'border-gray-100'}`} value={form.phone} onChange={handlePhoneChange} />
                </div>
              </div>
              <ErrorMsg name="phone" />
            </div>
          </div>
        </div>

        {/* Seleção de Plano */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/60 space-y-5 w-full box-border">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0"><ShoppingCart className="w-5 h-5" /></div>
            <h2 className="font-extrabold text-lg tracking-tight text-gray-800">Escolha o Plano</h2>
          </div>
          <div className="space-y-3">
            {data.products.map(product => {
              const serviceConfig = parseServiceConfig(product.service_config);
              const isCredits = serviceConfig?.mode === 'credits';
              const isSelected = selectedProductId === product.id;

              return (
                <div key={product.id} onClick={() => handleProductSelection(product)} className={`flex flex-col p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-50 bg-gray-50'}`}>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 overflow-hidden mr-4 shadow-sm shrink-0">
                      <img src={getImageUrl(product.image, 'product')} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                      <h3 className="font-bold text-sm text-gray-800 leading-tight truncate">{product.product_name}</h3>
                      <p className="text-lg font-black text-gray-900 mt-1">
                        {isCredits ? `R$ ${formatCurrency(getUnitPrice(product, productQuantity))}/crédito` : `R$ ${formatCurrency(product.final_price)}`}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-primary border-primary scale-110' : 'bg-white border-gray-200'}`}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </div>

                  {isSelected && isCredits && serviceConfig && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5" /> Quantidade de Créditos
                          </label>
                          <div className="flex items-center gap-1.5">
                             <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-black tabular-nums">{productQuantity}</span>
                          </div>
                        </div>
                        <input 
                          type="range" 
                          min={parseInt(String(serviceConfig.min_credits)) || 1} 
                          max={parseInt(String(serviceConfig.max_credits)) || 5000} 
                          step="1"
                          value={productQuantity}
                          onChange={(e) => setProductQuantity(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={(e) => { e.stopPropagation(); updateProductQuantity(-10); }} className="h-10 bg-white border border-gray-200 rounded-xl font-bold text-[11px] hover:border-primary/30 active:scale-95 transition-all">-10</button>
                          <button onClick={(e) => { e.stopPropagation(); updateProductQuantity(10); }} className="h-10 bg-white border border-gray-200 rounded-xl font-bold text-[11px] hover:border-primary/30 active:scale-95 transition-all">+10</button>
                        </div>
                      </div>

                      {serviceConfig.price_tiers && (serviceConfig.price_tiers as PriceTier[]).length > 0 && (
                        <div className="bg-white/50 rounded-xl p-3 border border-primary/10">
                          <h4 className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 mb-2">
                            <TrendingUp className="w-3 h-3" /> Tabela de Descontos
                          </h4>
                          <div className="space-y-1.5">
                            {(serviceConfig.price_tiers as PriceTier[]).map((tier, i) => {
                              const isActive = productQuantity >= tier.from && (tier.to === 0 || productQuantity <= tier.to);
                              return (
                                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' : 'bg-gray-50 text-gray-500 opacity-60'}`}>
                                  <span className="text-[10px] font-black">
                                    {tier.from} {tier.to > 0 ? `a ${tier.to}` : '+'} créditos
                                  </span>
                                  <span className="text-[10px] font-black">R$ {formatCurrency(tier.price)} /cr</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isSelected && !isCredits && isEnabled(product.allow_quantity_selection) && (
                    <div className="mt-4 flex items-center justify-between bg-white/50 p-2 rounded-xl border border-primary/10" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Quantidade</span>
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); updateProductQuantity(-1); }} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"><Minus className="w-4 h-4" /></button>
                        <span className="font-black text-sm text-gray-800 w-4 text-center">{productQuantity}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateProductQuantity(1); }} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Bumps */}
        {isEnabled(data.checkout.order_bumps_enabled) && availableBumps.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-dashed border-primary/20 space-y-5 relative overflow-hidden w-full box-border">
            <div className="absolute top-0 right-0 p-3 text-primary"><Zap className="w-5 h-5 animate-pulse" /></div>
            <div className="text-center">
              <span className="bg-primary text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-primary/30">
                {data.checkout.order_bump_message}
              </span>
            </div>
            <div className="space-y-4">
              {availableBumps.map(bump => (
                <div key={bump.id} onClick={() => toggleBump(bump)} className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedBumps[bump.id] ? 'bg-primary/5 border-primary shadow-inner' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl p-1.5 border border-gray-50 shrink-0 shadow-sm">
                      <img src={getImageUrl(bump.image, 'product')} className="w-full h-full object-contain" alt="" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-start">
                        <h4 className="text-[11px] font-bold text-gray-800 leading-tight pr-2 truncate">{bump.product_name}</h4>
                        <span className="text-[11px] font-black text-primary whitespace-nowrap shrink-0">R$ {formatCurrency(bump.final_price)}</span>
                      </div>
                      <p className="text-[9px] text-gray-500 mt-1 line-clamp-2">{bump.description}</p>
                    </div>
                    <div className="flex items-center shrink-0">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${selectedBumps[bump.id] ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                        {selectedBumps[bump.id] && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </div>
                  {selectedBumps[bump.id] && isEnabled(bump.allow_quantity_selection) && (
                    <div className="mt-3 flex items-center justify-between bg-white p-2 rounded-xl border border-primary/10" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-black uppercase text-gray-400 ml-2 tracking-widest">Qtd</span>
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); updateBumpQuantity(bump.id, -1); }} className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="font-black text-xs text-gray-800 w-4 text-center">{selectedBumps[bump.id]}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateBumpQuantity(bump.id, 1); }} className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagamento */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/60 space-y-6 w-full box-border">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0"><CardIcon className="w-5 h-5" /></div>
            <h2 className="font-extrabold text-lg tracking-tight text-gray-800">Pagamento</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
            {data.payment_methods.map(method => (
              <button key={method.id} onClick={() => setPaymentMethod(method.payment_methods)} className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300 ${paymentMethod === method.payment_methods ? 'bg-white shadow-xl border border-gray-100 text-gray-900 translate-y-[-2px]' : 'text-gray-400 hover:text-gray-600'}`}>
                {method.payment_methods === 'pix' && <PixIcon className="w-7 h-7" />}
                {method.payment_methods === 'boleto' && <FileText className="w-7 h-7" />}
                {method.payment_methods === 'credit_card' && <CardIcon className="w-7 h-7" />}
                <span className="text-[8px] font-black uppercase tracking-widest">{method.payment_methods === 'credit_card' ? 'CARTÃO' : method.payment_methods.toUpperCase()}</span>
                {method.discount_percentage && <span className="text-[7px] font-black text-green-500">-{method.discount_percentage}%</span>}
              </button>
            ))}
          </div>
          <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
            {paymentMethod === 'pix' && (
              <div className="animate-in fade-in duration-300 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500 shrink-0"><Zap className="w-5 h-5" /></div>
                <div><h5 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Liberação Imediata</h5><p className="text-[10px] text-gray-500">Acesso via e-mail em segundos.</p></div>
              </div>
            )}
            {paymentMethod === 'credit_card' && (
              <div className="animate-in fade-in duration-300 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0"><CardIcon className="w-5 h-5" /></div>
                  <div><h5 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Cartão de Crédito</h5><p className="text-[10px] text-gray-500">Processado via <span className="font-bold text-blue-600">{getActiveGatewayName()}</span></p></div>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nome do Titular</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input name="card_holder" type="text" placeholder="COMO ESTÁ NO CARTÃO" className={`w-full bg-white border rounded-xl py-4 pl-11 pr-4 text-[11px] font-bold uppercase transition-all outline-none focus:ring-2 focus:ring-primary/20 ${errors.card_holder ? 'border-red-500' : 'border-gray-100'}`} value={cardForm.name} onChange={e => { setCardForm(prev => ({ ...prev, name: e.target.value.toUpperCase() })); if (errors.card_holder) setErrors({...errors, card_holder: ''}); }} />
                    </div>
                    <ErrorMsg name="card_holder" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Número do Cartão</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                        {cardBrand ? <img src={getBrandIcon(cardBrand) || ''} alt={cardBrand} className="w-full h-auto object-contain" /> : <CardSvg className="w-4 h-4 text-gray-300" />}
                      </div>
                      <input name="card_number" type="tel" placeholder="0000 0000 0000 0000" className={`w-full bg-white border rounded-xl py-4 pl-12 pr-4 text-[11px] font-bold transition-all outline-none focus:ring-2 focus:ring-primary/20 ${errors.card_number ? 'border-red-500' : 'border-gray-100'}`} value={cardForm.number} onChange={handleCardNumberChange} />
                    </div>
                    <ErrorMsg name="card_number" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Validade</label>
                      <input name="card_expiry" type="tel" placeholder="MM/AA" className={`w-full bg-white border rounded-xl py-4 px-4 text-[11px] font-bold transition-all outline-none focus:ring-2 focus:ring-primary/20 ${errors.card_expiry ? 'border-red-500' : 'border-gray-100'}`} value={cardForm.expiry} onChange={handleCardExpiryChange} />
                      <ErrorMsg name="card_expiry" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">CVV</label>
                      <input name="card_cvc" type="tel" placeholder="000" className={`w-full bg-white border rounded-xl py-4 px-4 text-[11px] font-bold transition-all outline-none focus:ring-2 focus:ring-primary/20 ${errors.card_cvc ? 'border-red-500' : 'border-gray-100'}`} value={cardForm.cvc} onChange={handleCardCvcChange} />
                      <ErrorMsg name="card_cvc" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Parcelamento</label>
                    <div className="relative">
                      <select className="w-full bg-white border border-gray-100 rounded-xl py-4 px-4 text-[11px] font-bold appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-primary/20" value={cardForm.installments} onChange={e => setCardForm(prev => ({ ...prev, installments: e.target.value }))}>
                        {[...Array(12)].map((_, i) => {
                          const count = i + 1;
                          const feeString = data.payment_methods.find(p => p.payment_methods === 'credit_card')?.installment_fee || "0";
                          const fee = parseFloat(feeString);
                          const installmentTotal = totals.total * (1 + (fee / 100) * (count - 1));
                          const valuePerInstallment = installmentTotal / count;
                          return <option key={count} value={count}>{count}x de R$ {formatCurrency(valuePerInstallment)} {fee === 0 || count === 1 ? 'sem juros' : `(com juros)`}</option>;
                        })}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-center pt-2"><div className="flex items-center gap-1 text-[9px] font-bold text-green-500 uppercase tracking-widest"><ShieldCheck className="w-3 h-3" /> Transação Criptografada</div></div>
              </div>
            )}
            {paymentMethod === 'boleto' && (
              <div className="animate-in fade-in duration-300 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0"><Clock className="w-5 h-5" /></div>
                <div><h5 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Boleto Bancário</h5><p className="text-[10px] text-gray-500">Compensação em até 48h úteis.</p></div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 opacity-50"><Lock className="w-3.5 h-3.5 text-gray-500" /><span className="text-[10px] font-black uppercase tracking-widest">Ambiente Seguro</span></div>
        </div>

        {/* Cupom */}
        {isEnabled(data.checkout.coupons_enabled) && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/60 w-full box-border">
            {!activeCoupon ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input type="text" placeholder="CUPOM DE DESCONTO" className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-black placeholder:text-gray-300 uppercase tracking-widest outline-none focus:bg-white transition-all text-base" value={couponCode} onChange={e => setCouponCode(e.target.value)} />
                </div>
                <button onClick={handleApplyCoupon} className="bg-gray-900 text-white px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shrink-0">Aplicar</button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-green-50 p-4 rounded-2xl border border-green-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0"><Tag className="w-4 h-4" /></div>
                  <div><p className="text-[10px] font-black uppercase tracking-widest text-green-600">Cupom Ativo</p><p className="text-xs font-bold text-green-700">{activeCoupon.code} • Desconto aplicado</p></div>
                </div>
                <button onClick={removeCoupon} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
              </div>
            )}
            {errors.coupon && <div className="mt-2 text-red-500 text-[10px] font-bold uppercase tracking-widest">{errors.coupon}</div>}
          </div>
        )}

        {/* Resumo Final - Ticket Style */}
        <div className="relative w-full pb-8">
          <div className="bg-white p-8 pt-10 shadow-2xl space-y-5 border-t-8 w-full box-border ticket-summary relative overflow-visible" style={{ borderTopColor: 'var(--primary-color)' }}>
            <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em]">
              <span>Descrição do Pedido</span>
              <span className="font-black tabular-nums">Valor</span>
            </div>
            
            <div className="space-y-3">
              {/* Main Product */}
              <div className="flex justify-between text-[11px] font-black text-gray-700 uppercase">
                <span className="truncate pr-4 flex-1">{selectedProduct?.product_name} x{productQuantity}</span>
                <span className="tabular-nums shrink-0">R$ {formatCurrency(currentUnitPrice * productQuantity)}</span>
              </div>

              {/* Selected Order Bumps */}
              {Object.entries(selectedBumps).map(([id, qty]) => {
                const bump = data.orderbumps.find(b => b.id === Number(id));
                if (!bump) return null;
                return (
                  <div key={id} className="flex justify-between text-[11px] font-black text-gray-500 uppercase animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="truncate pr-4 flex-1">+ {bump.product_name} {qty > 1 ? `x${qty}` : ''}</span>
                    <span className="tabular-nums shrink-0">R$ {formatCurrency(parseFloat(bump.final_price) * qty)}</span>
                  </div>
                );
              })}
            </div>

            {totals.discount > 0 && (
              <div className="flex justify-between text-[11px] font-black text-green-600 uppercase tracking-widest bg-green-50 p-4 rounded-2xl border border-green-100 border-dashed animate-in slide-in-from-right-4 duration-500">
                <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Descontos e Ofertas</span>
                <span className="tabular-nums">- R$ {formatCurrency(totals.discount)}</span>
              </div>
            )}

            <div className="relative h-px w-full my-6 flex items-center justify-center overflow-visible">
              <div className="absolute inset-0 border-t-2 border-dashed border-gray-100 w-full"></div>
            </div>

            <div className="flex justify-between items-center py-2">
              <div className="space-y-1">
                <span className="font-black text-gray-800 uppercase text-[10px] tracking-[0.2em] opacity-50 block">Valor Final</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-primary px-2 py-0.5 bg-primary/5 rounded border border-primary/10">A PAGAR</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="text-lg font-bold text-gray-900">R$</span>
                  <span className="text-5xl font-black text-gray-900 tabular-nums tracking-tighter leading-none">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {reviewsData && (
          <div className="space-y-6 pt-10">
            <div className="text-center space-y-1">
              <h3 className="font-black text-lg tracking-tight uppercase" style={{ color: reviewsData.config.text_color }}>{reviewsData.config.title}</h3>
              <p className="text-xs font-medium text-gray-400">{reviewsData.config.subtitle}</p>
            </div>
            <div className="flex flex-col gap-4">
              {reviewsData.items.map((review, idx) => (
                <div key={idx} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden shrink-0">
                        <img src={review.avatar && review.avatar.length > 5 ? getImageUrl(review.avatar, 'review') : `https://ui-avatars.com/api/?name=${review.name}&background=random`} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${review.name}&background=random`; }} />
                      </div>
                      <div>
                        <h4 className="font-black text-[12px] text-gray-800 leading-none">{review.name}</h4>
                        <div className="flex gap-0.5 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-gray-300 uppercase">{review.date}</span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-600 italic leading-relaxed">"{review.text}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selos Segurança */}
        <div className="space-y-6 pb-12 text-center opacity-50 hover:opacity-100 transition-all duration-700 w-full">
          <div className="flex items-center justify-center gap-6">
            <img src="https://img.icons8.com/color/48/000000/visa.png" className="h-6" alt="Visa" />
            <img src="https://img.icons8.com/color/48/000000/mastercard.png" className="h-6" alt="Mastercard" />
            <ShieldCheck className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-[9px] text-gray-400 max-w-[300px] mx-auto uppercase font-black tracking-widest leading-relaxed">Checkout Seguro • Processado por PagLink</p>
        </div>
      </div>

      {/* Checkout Footer Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-gray-100 px-5 pt-2 pb-5 z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.12)] w-full overflow-hidden">
        <div className="max-w-[480px] mx-auto space-y-1.5">
          {isEnabled(data.checkout.sales_counter_enabled) && (
            <div className="flex items-center justify-center gap-1.5 animate-in fade-in duration-700 h-4">
              <div className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </div>
              <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap overflow-hidden">
                <span className="text-gray-800 tabular-nums">{salesCount}</span> {data.checkout.sales_message}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col shrink-0">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5 opacity-80">Total a pagar</span>
              <span className="text-2xl font-black text-gray-900 tabular-nums leading-none tracking-tighter">R$ {formatCurrency(totals.total)}</span>
            </div>
            <button 
              onClick={handleFinalize} 
              disabled={processing}
              className="flex-1 group relative overflow-hidden flex items-center justify-center gap-2 h-14 rounded-2xl text-white font-black text-base shadow-2xl shadow-primary/40 border-b-4 border-black/10 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              style={{ background: `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)` }}
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="uppercase tracking-tight">Processando...</span>
                </div>
              ) : (
                <>
                  <span className="relative z-10 flex items-center gap-1 uppercase tracking-tight">
                    FINALIZAR AGORA <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out skew-x-12"></div>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <a href="https://wa.me/5511937625269" target="_blank" rel="noreferrer" className="fixed bottom-[130px] right-6 z-[99] flex items-center justify-center w-14 h-14 bg-[#25d366] rounded-2xl shadow-2xl hover:scale-110 active:scale-90 transition-all border-4 border-white group">
        <div className="absolute inset-0 rounded-2xl bg-[#25d366] animate-ping opacity-20"></div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-8 h-8 relative z-10">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      </a>

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 45s linear infinite; }
        :root { --primary-color: ${data.checkout.primary_color}; --secondary-color: ${data.checkout.secondary_color}; --bg-color: ${data.checkout.background_color}; }
        .bg-primary { background-color: var(--primary-color); }
        .text-primary { color: var(--primary-color); }
        .border-primary { border-color: var(--primary-color); }
        html, body { width: 100%; margin: 0; padding: 0; overflow-x: hidden; }
        input:focus, select:focus { outline: none !important; border-color: var(--primary-color) !important; box-shadow: 0 0 0 3px rgba(var(--primary-color), 0.1) !important; }
        
        .ticket-summary {
          border-radius: 1.5rem 1.5rem 0 0;
          -webkit-mask: 
            conic-gradient(from -45deg at bottom, #000 90deg, #0000 0) 0 100% / 20px 10px repeat-x,
            linear-gradient(#000 0 0) 0 0 / 100% calc(100% - 10px) no-repeat;
          mask: 
            conic-gradient(from -45deg at bottom, #000 90deg, #0000 0) 0 100% / 20px 10px repeat-x,
            linear-gradient(#000 0 0) 0 0 / 100% calc(100% - 10px) no-repeat;
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 4px solid var(--primary-color);
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          margin-top: -8px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #e5e7eb;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default App;