# Versioning and Change Control

## Version Format

This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with custom increment rules:

**Format**: `MAJOR.MINOR.PATCH` (e.g., `0.1.0`)

## Version Increment Rules

### Patch (0.0.1) - Small Changes
- Bug fixes
- Minor updates
- Small refactoring
- Documentation updates (non-breaking)
- Small UI tweaks

**Example**: `0.1.0` → `0.1.1`

### Minor (0.1.0) - Medium Changes
- New features
- Significant updates
- New components
- API additions (non-breaking)
- Medium refactoring

**Example**: `0.1.0` → `0.2.0`

### Major (1.0.0) - Major Releases
- Production-ready milestones
- Breaking changes
- Major architectural changes
- Complete feature rewrites
- Major version releases

**Example**: `0.9.9` → `1.0.0`

## Version Limits

- **Maximum at 9**: When any segment reaches 9 and needs to increment, move to the next level
- **Example**: `0.9.9` + patch increment → `1.0.0` (not `0.9.10`)
- **Example**: `0.9.0` + minor increment → `1.0.0` (not `0.10.0`)

## Changelog Requirements

### Always Update Changelog

**Every code change must have a corresponding CHANGELOG.md entry.**

1. Update `CHANGELOG.md` with the change
2. Update `package.json` version number
3. Create commit with changelog entry

### Changelog Format

```markdown
## [VERSION] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Removed
- Removed features
```

## Commit Workflow

### Standard Workflow

1. **Make code changes**
2. **Update CHANGELOG.md** with entry for the change
3. **Update package.json** version (increment appropriately)
4. **Create commit** with changelog entry included

### Commit Message Format

```
[VERSION] Brief description

- Detail 1
- Detail 2

See CHANGELOG.md for full details.
```

## Version Number Location

- **Primary**: `package.json` - `"version": "X.Y.Z"`
- **Documentation**: `CHANGELOG.md` - Version headers
- **Commits**: Include version in commit message

## Documentation Updates

### Always Update Outdated Documentation

- If code changes affect documentation, **update the docs**
- Keep README.md accurate to current application state
- Update relevant docs/ files when patterns change
- Remove outdated information

## Cursor-Specific Files

- **Location**: `.cursor/` folder
- **Git Status**: Contents are git-ignored (except `.gitkeep`)
- **Purpose**: Store Cursor-specific configuration and files
- **Note**: Folder structure is tracked, but contents are not

## README Requirements

- **Must be accurate** to the current application state
- **Developer-facing**: Should help developers understand and work with the project
- **Update when**:
  - Tech stack changes
  - Project structure changes
  - New features are added
  - Getting started instructions change

## Examples

### Small Change (Patch)

**Before**: `0.1.0`
**Change**: Fix typo in component name
**After**: `0.1.1`

```markdown
## [0.1.1] - 2026-01-27

### Fixed
- Fixed typo in component name
```

### Medium Change (Minor)

**Before**: `0.1.0`
**Change**: Add new widget component
**After**: `0.2.0`

```markdown
## [0.2.0] - 2026-01-27

### Added
- New StatsWidget component
- Widget configuration system
```

### Major Change (Major)

**Before**: `0.9.9`
**Change**: Complete rewrite of data architecture
**After**: `1.0.0`

```markdown
## [1.0.0] - 2026-01-27

### Changed
- Complete rewrite of data architecture
- Breaking: Changed API response format
- Breaking: Updated component prop interfaces
```

## Best Practices

1. **Increment appropriately**: Don't over-increment for small changes
2. **Document everything**: Every change should be in CHANGELOG.md
3. **Keep README current**: Update when application changes
4. **Version in commits**: Include version number in commit messages
5. **Update docs**: Keep documentation accurate and up-to-date

## Quick Reference

| Change Type | Increment | Example |
|------------|-----------|---------|
| Bug fix | Patch (0.0.1) | 0.1.0 → 0.1.1 |
| New feature | Minor (0.1.0) | 0.1.0 → 0.2.0 |
| Breaking change | Major (1.0.0) | 0.9.9 → 1.0.0 |
| Max reached | Next level | 0.9.9 → 1.0.0 |
