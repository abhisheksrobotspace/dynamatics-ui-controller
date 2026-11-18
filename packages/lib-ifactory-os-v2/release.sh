#!/bin/bash

# Enhanced template-based release script for rs-runtime OTA system with nginx support
# Usage: ./release.sh [--dry-run] [--bundle-deps]
# Interactive prompts (same style as version bump):
#   1) select version bump: Major | Minor | Patch
# PMS line (angle/plate) is chosen at runtime from machineSettings.assetClass — one build.

set -euo pipefail

# Colors for output
GREEN=$'\e[0;32m'
RED=$'\e[0;31m'
YELLOW=$'\e[1;33m'
BLUE=$'\e[0;34m'
NC=$'\e[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
RELEASE_DIR="$SCRIPT_DIR/releases"
TEMPLATE_DIR="$SCRIPT_DIR/ota-templates"
DRY_RUN=false
BUNDLE_DEPS=false

# Global variable to store bundle dependencies result
BUNDLE_DEPS_RESULT="false"

# ALLOWED BRANCH FOR DEPLOYMENT (unified JSL PMS; line from machineSettings at runtime)
DEPLOYMENT_BRANCH=feat/hmi-os-ui-redesign

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --bundle-deps)
            BUNDLE_DEPS=true
            shift
            ;;
        *)
            echo "${RED}Unknown option: $1${NC}"
            echo "Usage: ./release.sh [--dry-run] [--bundle-deps]"
            exit 1
            ;;
    esac
done

log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo "${BLUE}[STEP]${NC} $1"
}

# Load configuration from template config file
load_template_config() {
    local config_file="$TEMPLATE_DIR/ota-config.env"
    local project_config_file="$SCRIPT_DIR/ota-config.env"

    # Load default config
    if [[ -f "$config_file" ]]; then
        log_info "Loading default template configuration"
        source "$config_file"
    fi

    # Override with project-specific config if it exists
    if [[ -f "$project_config_file" ]]; then
        log_info "Loading project-specific configuration"
        source "$project_config_file"
    fi

    # Set defaults if not defined
    HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-"2s"}
    HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-"5"}
    HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-"30s"}
    HEALTH_CHECK_URL=${HEALTH_CHECK_URL:-"http://localhost:3000/health"}
    MIN_DISK_SPACE_MB=${MIN_DISK_SPACE_MB:-"500"}
    MIN_NODE_VERSION=${MIN_NODE_VERSION:-"16.0.0"}
    RS_RUNTIME_MIN_VERSION=${RS_RUNTIME_MIN_VERSION:-"1.0.0"}
    TARGET_PLATFORMS=${TARGET_PLATFORMS:-'["ioware-pro-x100", "ioware-gateway"]'}
    OS_REQUIREMENTS=${OS_REQUIREMENTS:-'["linux"]'}
    DEFAULT_AUTHOR=${DEFAULT_AUTHOR:-"Team Robotspace"}
    DEFAULT_LICENSE=${DEFAULT_LICENSE:-"ISC"}
    NGINX_DEFAULT_SERVER=${NGINX_DEFAULT_SERVER:-"true"}
    NGINX_SERVER_NAME=${NGINX_SERVER_NAME:-"_"}
}

# Validate template directory structure
validate_templates() {
    log_step "Validating template structure..."

    if [[ ! -d "$TEMPLATE_DIR" ]]; then
        log_error "Template directory not found: $TEMPLATE_DIR"
        log_info "Please create the ota-templates directory with required templates"
        exit 1
    fi

    local required_templates=(
        "Otafile.template"
        "ota_metadata.json.template"
        "ota-config.env"
    )

    for template in "${required_templates[@]}"; do
        if [[ ! -f "$TEMPLATE_DIR/$template" ]]; then
            log_error "Required template not found: $TEMPLATE_DIR/$template"
            exit 1
        fi
    done

    log_info "All required templates found"
}

# Validate nginx configuration exists in resources directory
validate_nginx_config_exists() {
    log_step "Validating nginx configuration..."

    local nginx_config_path="$SCRIPT_DIR/resources/${APP_NAME}.nginx.conf"

    if [[ ! -f "$nginx_config_path" ]]; then
        log_error "Nginx configuration not found: $nginx_config_path"
        log_info "Please create ${APP_NAME}.nginx.conf in the resources/ directory"
        exit 1
    fi

    # Basic validation - ensure it's not empty
    if [[ ! -s "$nginx_config_path" ]]; then
        log_error "Nginx configuration file is empty: $nginx_config_path"
        exit 1
    fi

    log_info "Nginx configuration found and valid: $nginx_config_path"
}

# Template substitution function
substitute_template() {
    local template_file="$1"
    local output_file="$2"

    log_info "Processing template: $(basename "$template_file")"

    # Read template
    local template_content=$(cat "$template_file")

    # Get values from package.json and current state
    local author=$(node -e "console.log(require('./package.json').author || '$DEFAULT_AUTHOR')" 2>/dev/null || echo "$DEFAULT_AUTHOR")
    local license=$(node -e "console.log(require('./package.json').license || '$DEFAULT_LICENSE')" 2>/dev/null || echo "$DEFAULT_LICENSE")
    local created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Perform substitutions - basic variables
    template_content=${template_content//\{\{APP_NAME\}\}/$APP_NAME}
    template_content=${template_content//\{\{APP_VERSION\}\}/$APP_VERSION}
    template_content=${template_content//\{\{INSTALL_DIR\}\}/$INSTALL_DIR}
    template_content=${template_content//\{\{BUNDLE_DEPS\}\}/$BUNDLE_DEPS_RESULT}
    template_content=${template_content//\{\{AUTHOR\}\}/$author}
    template_content=${template_content//\{\{LICENSE\}\}/$license}
    template_content=${template_content//\{\{CREATED_AT\}\}/$created_at}

    # Configuration-based substitutions
    template_content=${template_content//\{\{MIN_NODE_VERSION\}\}/$MIN_NODE_VERSION}
    template_content=${template_content//\{\{MIN_DISK_SPACE_MB\}\}/$MIN_DISK_SPACE_MB}
    template_content=${template_content//\{\{HEALTH_CHECK_INTERVAL\}\}/$HEALTH_CHECK_INTERVAL}
    template_content=${template_content//\{\{HEALTH_CHECK_RETRIES\}\}/$HEALTH_CHECK_RETRIES}
    template_content=${template_content//\{\{HEALTH_CHECK_TIMEOUT\}\}/$HEALTH_CHECK_TIMEOUT}
    template_content=${template_content//\{\{HEALTH_CHECK_URL\}\}/$HEALTH_CHECK_URL}
    template_content=${template_content//\{\{RS_RUNTIME_MIN_VERSION\}\}/$RS_RUNTIME_MIN_VERSION}
    template_content=${template_content//\{\{TARGET_PLATFORMS\}\}/$TARGET_PLATFORMS}
    template_content=${template_content//\{\{OS_REQUIREMENTS\}\}/$OS_REQUIREMENTS}

    # Write output
    echo "$template_content" > "$output_file"
    log_info "Template processed: $(basename "$output_file")"
}

# Validate git status
validate_git_status() {
    log_step "Validating git status..."

    # Check if we're on the allowed deployment branch
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != ${DEPLOYMENT_BRANCH} ]]; then
        log_error "Not on deployment branch ${DEPLOYMENT_BRANCH} (current: $current_branch)"
        exit 1
    fi

    # Pull latest changes
    log_info "Pulling latest commits..."
    local pull_result=$(git pull)
    if [[ "$pull_result" != *"Already up to date."* ]]; then
        log_error "Repository not up to date. Please review and try again."
        exit 1
    fi

    # Check working directory cleanliness (skip for dry run)
    if [[ "$DRY_RUN" == "false" ]]; then
        local git_status=$(git status --porcelain)
        if [[ -n "$git_status" ]]; then
            log_error "Working directory not clean:"
            git status --short
            exit 1
        fi
    else
        log_warn "Dry run: skipping working directory cleanliness check"
    fi
}

# Version management
manage_version() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "Dry run: skipping version update"
        return
    fi

    log_step "Managing version..."
    echo "Select version bump type:"
    select version_type in "Major" "Minor" "Patch"; do
        case $version_type in
            Major)
                npm version major
                git push
                break
                ;;
            Minor)
                npm version minor
                git push
                break
                ;;
            Patch)
                npm version patch
                git push
                break
                ;;
        esac
    done
}

# Get app metadata
get_app_metadata() {
    log_step "Extracting app metadata..."

    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found"
        exit 1
    fi

    APP_NAME=$(node -e "console.log(require('./package.json').app_name)")
    APP_VERSION=$(node -e "console.log(require('./package.json').version)")
    INSTALL_DIR=$(node -e "console.log(require('./package.json').install_dir || '/home/rs/apps')")

    log_info "App: $APP_NAME"
    log_info "Version: $APP_VERSION"
    log_info "Install Directory: $INSTALL_DIR"
}

# Clean and build
clean_and_build() {
    log_step "Cleaning and building..."

    # Clean build directories
    rm -rf "$BUILD_DIR"
    rm -rf "$RELEASE_DIR/staging"
    rm -rf data/logs/* 2>/dev/null || true
    rm -rf logs/* 2>/dev/null || true

    # Link OS to the app
    log_info "Linking to the app"
    (cd ../lib-ifactory-ui-v2 && npm run prepack)

    # One ioware build — PMS screens switch at runtime from machineSettings.assetClass
    log_info "Running npm run build:ioware..."
    npm run build:ioware

    if [[ ! -d "$BUILD_DIR" ]]; then
        log_error "Build failed: $BUILD_DIR not created"
        exit 1
    fi
}

# For static UI applications, dependencies are not bundled
# The build process compiles everything into static assets
prepare_static_app() {
    log_info "Preparing static UI application - no runtime dependencies needed"
    BUNDLE_DEPS_RESULT="false"
}

# Create app bundle for static UI application
create_app_bundle() {
    log_step "Creating app bundle..."

    local staging_dir="$RELEASE_DIR/staging"
    local app_dir="$staging_dir/app"

    mkdir -p "$app_dir"

    # Copy built static application (no node_modules needed for static builds)
    log_info "Copying static build output to app bundle..."
    cp -r "$BUILD_DIR/." "$app_dir/"
    cp "$SCRIPT_DIR/package.json" "$app_dir/"

    # Verify supervisor config exists in build output
    # if [[ ! -f "$app_dir/resources/$APP_NAME.supervisor.conf" ]]; then
    #     log_error "Supervisor config not found in build output: $BUILD_DIR/resources/$APP_NAME.supervisor.conf"
    #     log_info "Please ensure supervisor config is included in your build process as $APP_NAME.supervisor.conf"
    #     exit 1
    # fi

    # Create app tarball with consistent naming
    cd "$staging_dir"
    tar -czf "app_content.tar.gz" app/
    rm -rf app/
    cd "$SCRIPT_DIR"

    log_info "Static app bundle created successfully"
}

# Create nginx configuration file
create_nginx_config() {
    log_step "Creating nginx configuration..."

    local staging_dir="$RELEASE_DIR/staging"
    local nginx_config_source="$SCRIPT_DIR/resources/${APP_NAME}.nginx.conf"
    local nginx_config_dest="$staging_dir/${APP_NAME}.conf"

    # Copy nginx config from build resources to staging with proper naming
    cp "$nginx_config_source" "$nginx_config_dest"

    # Apply template substitutions to nginx config if needed
    # This allows nginx configs to use {{APP_NAME}}, {{INSTALL_DIR}} etc.
    substitute_nginx_template "$nginx_config_dest"

    log_info "Nginx configuration created: ${APP_NAME}.conf (from ${APP_NAME}.nginx.conf)"
}

# Apply template substitutions to nginx configuration
substitute_nginx_template() {
    local nginx_config_file="$1"

    log_info "Applying template substitutions to nginx config"

    # Read nginx config content
    local nginx_content=$(cat "$nginx_config_file")

    # Apply substitutions
    nginx_content=${nginx_content//\{\{APP_NAME\}\}/$APP_NAME}
    nginx_content=${nginx_content//\{\{APP_VERSION\}\}/$APP_VERSION}
    nginx_content=${nginx_content//\{\{INSTALL_DIR\}\}/$INSTALL_DIR}
    nginx_content=${nginx_content//\{\{NGINX_DEFAULT_SERVER\}\}/$NGINX_DEFAULT_SERVER}
    nginx_content=${nginx_content//\{\{NGINX_SERVER_NAME\}\}/$NGINX_SERVER_NAME}

    # Write back the substituted content
    echo "$nginx_content" > "$nginx_config_file"

    log_info "Nginx config template substitutions completed"
}

# Create Otafile from template
create_otafile() {
    local staging_dir="$RELEASE_DIR/staging"
    local otafile="$staging_dir/Otafile"
    local template_file="$TEMPLATE_DIR/Otafile.template"

    log_step "Creating Otafile from template..."

    # Verify supervisor config exists in build output
    # if [[ ! -f "$BUILD_DIR/resources/$APP_NAME.supervisor.conf" ]]; then
    #     log_error "Supervisor config not found: $BUILD_DIR/resources/$APP_NAME.supervisor.conf"
    #     log_info "Please create the supervisor config file as $APP_NAME.supervisor.conf in resources/ directory"
    #     exit 1
    # fi

    # Process template
    substitute_template "$template_file" "$otafile"
}

# Generate metadata from template
generate_metadata() {
    local staging_dir="$RELEASE_DIR/staging"
    local metadata_file="$staging_dir/ota_metadata.json"
    local template_file="$TEMPLATE_DIR/ota_metadata.json.template"

    log_step "Generating metadata from template..."

    # Calculate checksums for all components
    local app_tarball="$staging_dir/app_content.tar.gz"
    local nginx_config="$staging_dir/${APP_NAME}.conf"

    if [[ ! -f "$app_tarball" ]]; then
        log_error "App content tarball not found: $app_tarball"
        return 1
    fi

    if [[ ! -f "$nginx_config" ]]; then
        log_error "Nginx config not found: $nginx_config"
        return 1
    fi

    local app_checksum=$(sha256sum "$app_tarball" | cut -d' ' -f1)
    local nginx_checksum=$(sha256sum "$nginx_config" | cut -d' ' -f1)
    local otafile_checksum=$(sha256sum "$staging_dir/Otafile" | cut -d' ' -f1)
    local app_tarball_size=$(stat -c%s "$app_tarball")
    local nginx_config_size=$(stat -c%s "$nginx_config")
    local otafile_size=$(stat -c%s "$staging_dir/Otafile")

    # Process template with basic substitutions
    substitute_template "$template_file" "$metadata_file"

    # Post-process to add calculated values that couldn't be substituted during template processing
    sed -i "s/{{APP_TARBALL_CHECKSUM}}/$app_checksum/g" "$metadata_file"
    sed -i "s/{{NGINX_CONFIG_CHECKSUM}}/$nginx_checksum/g" "$metadata_file"
    sed -i "s/{{OTAFILE_CHECKSUM}}/$otafile_checksum/g" "$metadata_file"
    sed -i "s/{{APP_TARBALL_SIZE}}/$app_tarball_size/g" "$metadata_file"
    sed -i "s/{{NGINX_CONFIG_SIZE}}/$nginx_config_size/g" "$metadata_file"
    sed -i "s/{{OTAFILE_SIZE}}/$otafile_size/g" "$metadata_file"
    sed -i "s/{{PACKAGE_CHECKSUM}}/PLACEHOLDER_FOR_PACKAGE_CHECKSUM/g" "$metadata_file"
}

# Create release package
create_release_package() {
    log_step "Creating final release package..."

    local staging_dir="$RELEASE_DIR/staging"
    local version_dir="$RELEASE_DIR/${APP_VERSION}"

    # Create version directory
    mkdir -p "$version_dir"

    # Create final OTA package (single artifact as required)
    cd "$staging_dir"
    tar -czf "$version_dir/app.tar.gz" .
    cd "$SCRIPT_DIR"

    # Calculate package checksum and update metadata
    local package_checksum=$(sha256sum "$version_dir/app.tar.gz" | cut -d' ' -f1)

    # Update the metadata with the actual package checksum
    sed -i "s/PLACEHOLDER_FOR_PACKAGE_CHECKSUM/$package_checksum/" "$staging_dir/ota_metadata.json"

    # Copy package.json to work with current console
    cp "$SCRIPT_DIR/package.json" "$staging_dir/"

    # Recreate the package with updated metadata
    cd "$staging_dir"
    tar -czf "$version_dir/app.tar.gz" .
    cd "$SCRIPT_DIR"

    # Recalculate final checksum (this is the one the runtime will validate)
    local final_checksum=$(sha256sum "$version_dir/app.tar.gz" | cut -d' ' -f1)

    # Update metadata one more time with final checksum
    sed -i "s/$package_checksum/$final_checksum/" "$staging_dir/ota_metadata.json"

    # Final package creation - this is the SINGLE artifact for upload
    cd "$staging_dir"
    tar -czf "$version_dir/app.tar.gz" .
    cd "$SCRIPT_DIR"

    # Copy individual files for inspection/debugging
    cp "$staging_dir/ota_metadata.json" "$version_dir/"
    cp "$staging_dir/Otafile" "$version_dir/"
    cp "$staging_dir/${APP_NAME}.conf" "$version_dir/"

    log_info "Single OTA artifact created: $version_dir/app.tar.gz"
    log_info "Final package checksum: $(sha256sum "$version_dir/app.tar.gz" | cut -d' ' -f1)"
    log_info "Package structure:"
    tar -tzf "$version_dir/app.tar.gz" | sed 's/^/  /'
    log_info ""
    log_info "This single app.tar.gz file contains:"
    log_info "  - ota_metadata.json (package metadata and checksums)"
    log_info "  - Otafile (installation instructions)"
    log_info "  - app_content.tar.gz (the static UI application)"
    log_info "  - ${APP_NAME}.conf (nginx configuration)"
}

# Git operations
commit_and_tag() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "Dry run: skipping git commit and tag"
        return
    fi

    log_step "Committing and tagging release..."

    local release_tag="v${APP_VERSION}"

    # Only add the specific version directory, not the entire releases/ directory
    git add "releases/${APP_VERSION}/"
    git commit -m "Release $APP_NAME v$APP_VERSION"

    # Check if tag already exists
    if git tag -l "$release_tag" | grep -q "$release_tag"; then
        log_warn "Tag $release_tag already exists, recreating..."
        git tag -d "$release_tag"
        git push origin :refs/tags/"$release_tag" 2>/dev/null || log_warn "Remote tag $release_tag didn't exist"
    fi

    git tag -a "$release_tag" -m "Release $APP_NAME v$APP_VERSION"
    git push origin "$release_tag"
    git push
}

# Cleanup
cleanup_staging() {
    log_step "Cleaning up staging area..."
    rm -rf "$RELEASE_DIR/staging"
}

# Main execution
main() {
    log_info "Starting template-based release process..."

    # Load configuration and validate templates
    load_template_config
    validate_templates

    validate_git_status
    manage_version
    get_app_metadata
    clean_and_build

    # Prepare release directory
    mkdir -p "$RELEASE_DIR/staging"

    # Validate nginx configuration exists (after build, before creating bundle)
    validate_nginx_config_exists

    # Prepare static app configuration
    prepare_static_app

    # Create app bundle - this sets BUNDLE_DEPS_RESULT global variable
    create_app_bundle

    # Create nginx configuration
    create_nginx_config

    # Create OTA files using templates
    create_otafile
    generate_metadata

    # Create final package
    create_release_package

    # Git operations
    commit_and_tag

    # Cleanup
    cleanup_staging

    log_info "Release process completed successfully!"
    log_info "Single OTA artifact: $RELEASE_DIR/${APP_VERSION}/app.tar.gz"
    log_info "Upload this single file to your OTA distribution system."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "This was a dry run. No changes were committed to git."
    fi
}

# Run main function
main "$@"
