import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthMe = error.config && error.config.url === '/auth/me'
      const isAlreadyOnLogin = window.location.pathname === '/login'
      const isConfirmation = error.config && (error.config.skipAuthRedirect || error.config.url?.includes('cancel-'))
      if (!isAuthMe && !isAlreadyOnLogin && !isConfirmation) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
