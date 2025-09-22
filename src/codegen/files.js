import fs from 'fs-extra';
import { dirname, join, resolve } from 'path';

/**
 * Ensures directory exists, creating it recursively if needed
 * @param {string} dirPath - Directory path to create
 */
export async function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

/**
 * Writes content to file with directory creation and security validation
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @param {object} options - Write options (format: boolean)
 * @returns {Promise<object>} Result object with success status and metadata
 */
export async function writeFile(filePath, content, options = {}) {
    try {
      // Validate file path to prevent directory traversal
      const resolvedPath = resolve(filePath);
      const cwd = process.cwd();
      
      if (!resolvedPath.startsWith(cwd)) {
        throw new Error(`File path outside project directory: ${filePath}`);
      }

      // Ensure the directory exists
      const dir = dirname(resolvedPath);
      await ensureDirectory(dir);

      // Format the content if needed
      const formattedContent = options.format !== false ?
        await formatTypeScript(content) : content;

      // Write the file
      fs.writeFileSync(resolvedPath, formattedContent, 'utf8');
      
      return {
        success: true,
        path: resolvedPath,
        size: formattedContent.length
      };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: error.message
      };
    }
  }

/**
 * Writes TypeScript type definitions to output directory
 * @param {string} outputPath - Output directory path
 * @param {string} content - TypeScript definitions content
 * @param {object} config - Configuration options (typesFileName)
 * @returns {Promise<object>} Write operation result
 */
export async function writeTypeDefinitions(outputPath, content, config = {}) {
    const fileName = config.typesFileName || 'api.ts';
    const filePath = join(outputPath, fileName);
    
    return writeFile(filePath, content, { format: true });
  }

/**
 * Writes API client code to output directory
 * @param {string} outputPath - Output directory path
 * @param {string} content - API client content
 * @param {object} config - Configuration options (clientFileName)
 * @returns {Promise<object>} Write operation result
 */
export async function writeApiClient(outputPath, content, config = {}) {
    const fileName = config.clientFileName || 'client.ts';
    const filePath = join(outputPath, fileName);
    
    return writeFile(filePath, content, { format: true });
  }

/**
 * Writes documentation files to project directory
 * @param {string} projectPath - Project root path
 * @param {string} content - Documentation content
 * @param {object} config - Configuration options (docsFileName)
 * @returns {Promise<object>} Write operation result
 */
export async function writeDocumentation(projectPath, content, config = {}) {
    const fileName = config.docsFileName || 'README.md';
    const filePath = join(projectPath, fileName);
    
    return writeFile(filePath, content, { format: false }); // Don't format markdown as TypeScript
  }

/**
 * Formats TypeScript content with basic formatting rules
 * @param {string} content - TypeScript content to format
 * @returns {Promise<string>} Formatted TypeScript content
 */
export async function formatTypeScript(content) {
    // Basic TypeScript formatting
    // In a real implementation, you might use prettier or similar
    return content
      .split('\n')
      .map(line => {
        // Remove trailing whitespace
        return line.trimEnd();
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple empty lines to max 2
      .trim() + '\n'; // Ensure file ends with newline
  }

export function generateSummaryReport(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const report = {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      files: successful.map(r => ({
        path: r.path,
        size: r.size
      })),
      errors: failed.map(r => ({
        path: r.path,
        error: r.error
      }))
    };

    return report;
  }

export function printGenerationReport(report, verbose = false) {
    console.log(`\n✅ Generated ${report.successful} of ${report.total} files successfully`);
    
    if (report.successful > 0) {
      console.log('\n📁 Generated files:');
      report.files.forEach(file => {
        const sizeKb = (file.size / 1024).toFixed(1);
        console.log(`   ${file.path} (${sizeKb}KB)`);
      });
    }

    if (report.failed > 0) {
      console.log(`\n❌ ${report.failed} files failed to generate:`);
      report.errors.forEach(error => {
        console.log(`   ${error.path}: ${error.error}`);
      });
    }

    if (verbose && report.successful > 0) {
      console.log('\n💡 Next steps:');
      console.log('   1. Check the generated TypeScript files compile: npx tsc --noEmit');
      console.log('   2. Import the types in your project: import { User } from "./types/api"');
      console.log('   3. Use the API client: import { ApiClient } from "./api/client"');
    }
  }

