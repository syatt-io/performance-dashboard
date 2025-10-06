# Production Security Setup Guide

This guide outlines the critical security configurations required before deploying to production.

## ✅ Critical Security Fixes Applied

### 1. CORS Configuration Fixed
- **Issue**: Wildcard CORS (`Access-Control-Allow-Origin: *`) was allowing all origins
- **Fix**: Environment-based CORS configuration
- **Configuration**: Set `ALLOWED_ORIGINS` environment variable with comma-separated list of allowed domains

### 2. Credential Encryption Implemented
- **Issue**: API keys and access tokens were stored in plain text
- **Fix**: AES encryption for sensitive credentials before database storage
- **Dependencies**: Added `crypto-js` for encryption utilities
- **Configuration**: Set `ENCRYPTION_KEY` environment variable with a strong encryption key

### 3. Service Account File Secured
- **Issue**: Google service account file was in repository root
- **Fix**: Moved to secure location outside repository
- **Location**: `~/.config/performance-dashboard/service-account.json`
- **Permissions**: Set to 600 (owner read/write only)

## 🔧 Required Environment Variables for Production

```bash
# Security (REQUIRED)
ENCRYPTION_KEY=your-very-strong-encryption-key-min-32-chars
ALLOWED_ORIGINS=https://yourdomain.com,https://dashboard.yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://username:password@host:port

# Server
NODE_ENV=production
PORT=3000

# Google Cloud Authentication
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/to/service-account.json
PAGESPEED_API_KEY=your_pagespeed_insights_api_key

# Optional: WebPageTest
WEBPAGETEST_API_KEY=your_webpagetest_api_key

# Monitoring
LIGHTHOUSE_INTERVAL_HOURS=6
MONITORING_ENABLED=true
MONITORING_HOUR=2
```

## 🔐 Production Deployment Checklist

### Before Deployment:
- [ ] Generate strong encryption key (32+ characters, random)
- [ ] Set ALLOWED_ORIGINS to your actual domain(s) only
- [ ] Move service account file to secure location outside web root
- [ ] Ensure service account file has restrictive permissions (600)
- [ ] Set NODE_ENV=production
- [ ] Configure production database with SSL
- [ ] Set up Redis with authentication
- [ ] Review all environment variables

### Security Best Practices:
- [ ] Use HTTPS only in production
- [ ] Implement rate limiting on API endpoints
- [ ] Set up monitoring and alerting
- [ ] Regular security updates for dependencies
- [ ] Database backups with encryption
- [ ] Log monitoring for suspicious activity

## 🔄 Credential Migration

If you have existing sites with plain text credentials in the database, they will be automatically encrypted on next update. The encryption utility includes migration logic:

```typescript
// Automatically detects and encrypts plain text credentials
const encryptedCredentials = encryptCredentials({ apiKey, accessToken });
```

## 🚨 Security Monitoring

Monitor these security-related logs:
- Failed decryption attempts (possible key rotation needed)
- CORS violations (unauthorized origin attempts)
- Authentication failures
- Database access patterns

## 📋 Security Validation

Test security configuration:

1. **CORS**: Attempt API access from unauthorized origin
2. **Encryption**: Verify credentials are encrypted in database
3. **File Permissions**: Check service account file permissions
4. **Environment**: Ensure no sensitive data in environment logs

## 🆘 Security Incident Response

If credentials are compromised:
1. Rotate encryption key immediately
2. Update all affected site credentials
3. Review access logs for unauthorized usage
4. Regenerate API keys (Google, WebPageTest, etc.)
5. Force credential re-encryption by updating sites

## 📞 Support

For security questions or issues:
- Review this guide thoroughly
- Check application logs for specific error messages
- Verify environment variable configuration
- Test in staging environment first