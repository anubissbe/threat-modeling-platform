#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TMACParser,
  TMACValidator,
  TMACAnalyzer,
  ThreatModel,
  ValidationResult,
  AnalysisResult
} from '@threatmodeling/tmac-core';

const program = new Command();

program
  .name('tmac')
  .description('CLI tool for Threat Modeling as Code')
  .version('1.0.0');

// Validate command
program
  .command('validate <file>')
  .description('Validate a TMAC file')
  .option('-v, --verbose', 'Show detailed validation output')
  .action(async (file: string, options: any) => {
    const spinner = ora('Validating TMAC file...').start();
    
    try {
      const model = await TMACParser.parseFile(file);
      const result = await TMACValidator.validate(model);
      
      if (result.valid) {
        spinner.succeed(chalk.green('✓ TMAC file is valid'));
        
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          result.warnings.forEach(warning => {
            console.log(chalk.yellow(`  ⚠ ${warning}`));
          });
        }
      } else {
        spinner.fail(chalk.red('✗ TMAC file is invalid'));
        console.log(chalk.red('\nErrors:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  ✗ ${error}`));
        });
      }
      
      if (options.verbose) {
        console.log('\n' + chalk.gray('File: ' + path.resolve(file)));
        console.log(chalk.gray(`Model: ${model.metadata.name} v${model.metadata.version || '1.0'}`));
      }
      
      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      spinner.fail(chalk.red('Failed to validate file'));
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze <file>')
  .description('Analyze a TMAC file for security findings')
  .option('-o, --output <format>', 'Output format (json|table)', 'table')
  .action(async (file: string, options: any) => {
    const spinner = ora('Analyzing threat model...').start();
    
    try {
      const model = await TMACParser.parseFile(file);
      const analysis = TMACAnalyzer.analyze(model);
      
      spinner.succeed(chalk.green('Analysis complete'));
      
      if (options.output === 'json') {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        displayAnalysisTable(analysis, model);
      }
      
      // Exit with error code if high/critical findings
      const hasHighFindings = analysis.findings.some(
        f => f.severity === 'critical' || f.severity === 'high'
      );
      process.exit(hasHighFindings ? 1 : 0);
    } catch (error) {
      spinner.fail(chalk.red('Failed to analyze file'));
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// Info command
program
  .command('info <file>')
  .description('Display information about a TMAC file')
  .action(async (file: string) => {
    const spinner = ora('Loading TMAC file...').start();
    
    try {
      const model = await TMACParser.parseFile(file);
      spinner.succeed(chalk.green('File loaded'));
      
      displayModelInfo(model);
    } catch (error) {
      spinner.fail(chalk.red('Failed to load file'));
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// Convert command
program
  .command('convert <input> <output>')
  .description('Convert between TMAC formats (YAML/JSON)')
  .action(async (input: string, output: string) => {
    const spinner = ora('Converting file...').start();
    
    try {
      const model = await TMACParser.parseFile(input);
      await TMACParser.saveToFile(model, output);
      
      spinner.succeed(chalk.green(`Converted ${input} → ${output}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to convert file'));
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// Merge command
program
  .command('merge <files...>')
  .description('Merge multiple TMAC files')
  .option('-o, --output <file>', 'Output file', 'merged.tmac.yaml')
  .action(async (files: string[], options: any) => {
    const spinner = ora('Merging TMAC files...').start();
    
    try {
      const models = await Promise.all(files.map(f => TMACParser.parseFile(f)));
      const merged = TMACParser.merge(models);
      
      await TMACParser.saveToFile(merged, options.output);
      
      spinner.succeed(chalk.green(`Merged ${files.length} files → ${options.output}`));
      
      console.log(chalk.cyan('\nMerged model summary:'));
      console.log(`  Components: ${merged.system.components.length}`);
      console.log(`  Data Flows: ${merged.dataFlows.length}`);
      console.log(`  Threats: ${merged.threats.length}`);
      console.log(`  Mitigations: ${merged.mitigations?.length || 0}`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to merge files'));
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// Helper functions
function displayAnalysisTable(analysis: AnalysisResult, model: ThreatModel): void {
  console.log(chalk.cyan('\n📊 Threat Model Analysis Report'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Summary
  console.log(chalk.white('\nSummary:'));
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Components', analysis.summary.totalComponents],
    ['Total Data Flows', analysis.summary.totalDataFlows],
    ['Total Threats', analysis.summary.totalThreats],
    ['Critical Threats', chalk.red(analysis.summary.criticalThreats)],
    ['High Threats', chalk.yellow(analysis.summary.highThreats)],
    ['Unmitigated Threats', chalk.red(analysis.summary.unmitigatedThreats)],
    ['Coverage', `${analysis.summary.coveragePercentage}%`],
    ['Risk Score', getRiskScoreColor(analysis.riskScore)]
  ];
  console.log(table(summaryData, { singleLine: true }));
  
  // Findings
  if (analysis.findings.length > 0) {
    console.log(chalk.white('\nFindings:'));
    const findingsData = [
      ['Severity', 'Type', 'Title', 'Components'],
      ...analysis.findings.map(f => [
        getSeverityColor(f.severity),
        f.type,
        f.title.substring(0, 40) + (f.title.length > 40 ? '...' : ''),
        (f.affectedComponents || []).join(', ')
      ])
    ];
    console.log(table(findingsData, { 
      columns: {
        2: { width: 40, wrapWord: true }
      }
    }));
  }
  
  // Recommendations
  if (analysis.recommendations.length > 0) {
    console.log(chalk.white('\nRecommendations:'));
    analysis.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. [${getSeverityColor(rec.priority)}] ${rec.title}`);
      console.log(chalk.gray(`     ${rec.description}`));
      console.log(chalk.gray(`     Effort: ${rec.effort}`));
    });
  }
  
  // Compliance
  if (analysis.complianceStatus.length > 0) {
    console.log(chalk.white('\nCompliance Status:'));
    analysis.complianceStatus.forEach(status => {
      const icon = status.status === 'compliant' ? '✓' : 
                   status.status === 'partial' ? '⚠' : '✗';
      const color = status.status === 'compliant' ? chalk.green : 
                    status.status === 'partial' ? chalk.yellow : chalk.red;
      console.log(`  ${color(icon)} ${status.framework}: ${status.status}`);
      if (status.gaps) {
        status.gaps.forEach(gap => {
          console.log(chalk.gray(`     - ${gap}`));
        });
      }
    });
  }
}

function displayModelInfo(model: ThreatModel): void {
  console.log(chalk.cyan('\n📋 Threat Model Information'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(chalk.white('\nMetadata:'));
  console.log(`  Name: ${model.metadata.name}`);
  console.log(`  Version: ${model.metadata.version || '1.0'}`);
  console.log(`  Author: ${model.metadata.author}`);
  console.log(`  Created: ${new Date(model.metadata.created).toLocaleDateString()}`);
  console.log(`  Updated: ${new Date(model.metadata.updated).toLocaleDateString()}`);
  
  if (model.metadata.tags && model.metadata.tags.length > 0) {
    console.log(`  Tags: ${model.metadata.tags.join(', ')}`);
  }
  
  if (model.metadata.compliance && model.metadata.compliance.length > 0) {
    console.log(`  Compliance: ${model.metadata.compliance.join(', ')}`);
  }
  
  console.log(chalk.white('\nSystem:'));
  console.log(`  Name: ${model.system.name}`);
  console.log(`  Type: ${model.system.type}`);
  console.log(`  Architecture: ${model.system.architecture || 'Not specified'}`);
  
  console.log(chalk.white('\nStatistics:'));
  const stats = [
    ['Category', 'Count'],
    ['Components', model.system.components.length],
    ['Trust Boundaries', model.system.trustBoundaries?.length || 0],
    ['Data Flows', model.dataFlows.length],
    ['Threats', model.threats.length],
    ['  - Critical', model.threats.filter(t => t.severity === 'critical').length],
    ['  - High', model.threats.filter(t => t.severity === 'high').length],
    ['  - Medium', model.threats.filter(t => t.severity === 'medium').length],
    ['  - Low', model.threats.filter(t => t.severity === 'low').length],
    ['Mitigations', model.mitigations?.length || 0],
    ['  - Implemented', model.mitigations?.filter(m => m.status === 'implemented').length || 0],
    ['  - In Progress', model.mitigations?.filter(m => m.status === 'in-progress').length || 0],
    ['  - Planned', model.mitigations?.filter(m => m.status === 'planned').length || 0]
  ];
  console.log(table(stats, { singleLine: true }));
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return chalk.red(severity.toUpperCase());
    case 'high': return chalk.yellow(severity.toUpperCase());
    case 'medium': return chalk.blue(severity.toUpperCase());
    case 'low': return chalk.gray(severity.toUpperCase());
    default: return chalk.white(severity.toUpperCase());
  }
}

function getRiskScoreColor(score: number): string {
  if (score >= 70) return chalk.red(`${score}/100`);
  if (score >= 40) return chalk.yellow(`${score}/100`);
  return chalk.green(`${score}/100`);
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}