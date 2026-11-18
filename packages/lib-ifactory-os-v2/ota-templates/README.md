# OTA Templates

This directory contains templates for generating OTA packages for rs-runtime.

## Template Files

### Core Templates

- `Otafile.template` - Installation instructions template
- `ota_metadata.json.template` - Package metadata template
- `ota-config.env` - Default configuration values

### Variable Substitution

Templates use `{{VARIABLE_NAME}}` syntax for substitution. Variables are categorized as:

#### App-Specific (from package.json)

- `{{APP_NAME}}` - Application name
- `{{APP_VERSION}}` - Application version
- `{{INSTALL_DIR}}` - Installation directory
- `{{AUTHOR}}` - Package author
- `{{LICENSE}}` - Package license

#### Build-Time

- `{{BUNDLE_DEPS}}` - Whether dependencies are bundled (true/false)
- `{{CREATED_AT}}` - ISO timestamp of package creation

#### Calculated (during metadata generation)

- `{{APP_TARBALL_SIZE}}` - Size of app content tarball
- `{{APP_TARBALL_CHECKSUM}}` - SHA256 of app content
- `{{OTAFILE_SIZE}}` - Size of Otafile
- `{{OTAFILE_CHECKSUM}}` - SHA256 of Otafile
- `{{PACKAGE_CHECKSUM}}` - SHA256 of final package

#### Configurable (from ota-config.env)

- `{{HEALTH_CHECK_INTERVAL}}` - Health check frequency
- `{{HEALTH_CHECK_RETRIES}}` - Number of health check attempts
- `{{HEALTH_CHECK_TIMEOUT}}` - Health check timeout
- `{{HEALTH_CHECK_URL}}` - Health check endpoint
- `{{MIN_DISK_SPACE_MB}}` - Minimum disk space requirement
- `{{MIN_NODE_VERSION}}` - Minimum Node.js version
- `{{RS_RUNTIME_MIN_VERSION}}` - Minimum rs-runtime version
- `{{TARGET_PLATFORMS}}` - JSON array of supported platforms
- `{{OS_REQUIREMENTS}}` - JSON array of supported OS

## Configuration Override

Create `ota-config.env` in your project root to override default values:

```bash
# Project-specific OTA configuration
HEALTH_CHECK_URL=http://localhost:8080/api/health
MIN_DISK_SPACE_MB=1000
TARGET_PLATFORMS=["custom-device-v1", "custom-device-v2"]
```

## Template Customization

### App-Specific Templates

If your app needs custom OTA logic, create app-specific templates:

```
ota-templates/
├── Otafile.template          # Default template
├── Otafile.myapp.template    # App-specific override
└── ota_metadata.json.template
```

The build script will automatically use `Otafile.{APP_NAME}.template` if it exists.

### Validation Rules

Templates must follow these rules:

1. **Otafile.template**:

   - Must contain `ENV APP_NAME {{APP_NAME}}`
   - Must contain `ENV APP_VERSION {{APP_VERSION}}`
   - Must have `ATOMIC_SWAP` for app replacement
   - Must include supervisor restart logic

2. **ota_metadata.json.template**:

   - Must be valid JSON after substitution
   - Must include `version`, `checksum`, `algorithm` fields
   - Must include `app_metadata.bundle_dependencies` field

3. **Variable Naming**:
   - Use `SCREAMING_SNAKE_CASE` for environment variables
   - Use descriptive names for custom variables
   - Avoid conflicts with existing bash variables

## Best Practices

### Template Design

- Keep templates generic and use configuration for app-specific values
- Include comprehensive error handling with `ON_ERROR` directives
- Add validation steps for critical files and services
- Use health checks to verify successful deployment

### Configuration Management

- Use `ota-config.env` for environment-specific values
- Keep sensitive values out of templates (use environment injection)
- Document any custom configuration variables

### Testing

- Test templates with dry-run: `./new-release.sh --dry-run`
- Validate generated Otafile syntax before deployment
- Verify all substituted variables are valid

## Template Development

### Adding New Variables

1. Add variable to `ota-config.env` with default value
2. Update `substitute_template()` function in release script
3. Document variable in this README
4. Test with multiple apps to ensure compatibility

### Template Validation

The release script validates:

- Template files exist
- Required variables are substituted
- Generated files are valid (JSON syntax for metadata)
- Required files exist (supervisor config, etc.)

### Debugging

Use these commands to debug template issues:

```bash
# Check template processing
./new-release.sh --dry-run

# Manually test template substitution
cat ota-templates/Otafile.template | envsubst

# Validate generated JSON
cat releases/staging/ota_metadata.json | jq .
```
