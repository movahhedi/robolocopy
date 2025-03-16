# RoboCopy CLI

A cross-platform file copying utility with glob pattern exclusions, inspired by Windows' robocopy.

## Installation

```bash
npm install -g robolocopy
```

## Usage

```bash
robolocopy <input-path> <output-path> [-x <exclude-glob>,<exclude-glob>,...] [-X] [-V]
```

Or specify multiple exclude patterns individually:

```bash
robolocopy <input-path> <output-path> [-x <exclude-glob>] [-x <exclude-glob>]
```

### Options

- `-x, --exclude <patterns...>` - Glob patterns to exclude, can be specified multiple times
- `-X, --ignore-defaults` - Ignore default exclusion patterns
- `-V, --verbose` - Enable verbose output
- `-v, --version` - Output the current version
- `-h, --help` - Display help information

### Default Exclude Patterns

By default, the following patterns are excluded:

- node_modules/**
- dist/**
- build/**
- temp/**
- delete/**
- tmp/**
- .git/**
- .DS_Store
- coverage/**
- .cache/**
- .idea/**
- .vscode/**
- *.log
- *.lock
- *.tgz
- *.tar.gz

## Examples

Copy a directory excluding node_modules:
```bash
robolocopy ./source ./destination -x "node_modules/**"
```

Copy with multiple exclusions:
```bash
robolocopy ./source ./destination -x "*.log" -x "temp/**"
```

Copy with verbose output:
```bash
robolocopy ./source ./destination -V
```

Copy ignoring default exclude patterns:
```bash
robolocopy ./source ./destination -X
```

## Performance

On Windows systems, the tool automatically uses the native `robocopy` command for improved performance when copying directories. On other platforms, it uses an optimized Node.js implementation with batched file operations.
