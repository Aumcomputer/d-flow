import axios from 'axios'
import { checkServerVersion } from './version'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => {
    const serverVersion = response.headers?.['x-app-version']
    if (serverVersion) {
      checkServerVersion(serverVersion)
    }
    return response
  },
  (error) => {
    const serverVersion = error.response?.headers?.['x-app-version']
    if (serverVersion) {
      checkServerVersion(serverVersion)
    }

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
