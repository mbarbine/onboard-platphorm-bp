# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability,
please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us at: **security@platphormnews.com**

Include the following in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

1. **Acknowledgment** - We will acknowledge receipt within 24 hours
2. **Assessment** - We will assess the vulnerability within 72 hours
3. **Fix Timeline** - Critical issues will be patched within 7 days
4. **Disclosure** - We follow responsible disclosure practices

### Scope

In scope:
- Application code
- API endpoints
- MCP server implementation
- Authentication and authorization
- Data handling and storage

Out of scope:
- Third-party dependencies (report to upstream)
- Social engineering attacks
- Physical security
- Denial of service attacks

### Recognition

We recognize security researchers who responsibly disclose vulnerabilities:
- Credit in security advisories
- Listing in SECURITY-THANKS.md
- Swag for significant findings

### Security Measures

The platform implements:
- Parameterized SQL queries (injection prevention)
- Content Security Policy headers
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure headers (HSTS, X-Frame-Options, etc.)

## Security Best Practices for Deployers

1. **Environment Variables** - Never commit secrets to git
2. **Database** - Use connection pooling and SSL
3. **Updates** - Keep dependencies updated
4. **Monitoring** - Enable error tracking and logging
5. **Backups** - Regular database backups

## Contact

- Security issues: security@platphormnews.com
- General questions: support@platphormnews.com
