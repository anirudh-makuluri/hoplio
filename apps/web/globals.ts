const PROD_BACKEND_URL = 'https://hoplio.onrender.com';
const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

export const globals = {
	BACKEND_URL: envBackendUrl || (process.env.NODE_ENV === 'production' ? PROD_BACKEND_URL : 'http://localhost:5000')
};
