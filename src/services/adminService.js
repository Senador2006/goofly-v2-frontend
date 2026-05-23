import api from './api'

export const adminService = {
  getMetricsOverview: () =>
    api.get('/admin/metrics/overview').then((res) => res.body.data),
}
