export function requestLogger(req, _res, next) {
  const startedAt = Date.now()
  _res.on('finish', () => {
    console.info(`${req.method} ${req.originalUrl} ${_res.statusCode} ${Date.now() - startedAt}ms`)
  })
  next()
}
