import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration, ChartType } from 'chart.js';
import { logger, reportLogger } from '../utils/logger';
import { ChartData, Threat, ThreatModelData } from '../types';

export class ChartGeneratorService {
  private chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor() {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: 'white',
      plugins: {
        modern: ['chartjs-adapter-date-fns'],
      },
    });
  }

  /**
   * Generate chart as image buffer
   */
  async generateChart(
    chartData: ChartData,
    options?: {
      width?: number;
      height?: number;
      format?: 'png' | 'jpeg' | 'pdf';
    }
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Create new canvas if custom dimensions
      let canvas = this.chartJSNodeCanvas;
      if (options?.width || options?.height) {
        canvas = new ChartJSNodeCanvas({
          width: options.width || 800,
          height: options.height || 600,
          backgroundColour: 'white',
        });
      }

      // Prepare chart configuration
      const configuration: ChartConfiguration = {
        type: chartData.type as ChartType,
        data: chartData.data,
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: chartData.title,
              font: {
                size: 18,
                weight: 'bold',
              },
            },
            legend: {
              display: true,
              position: 'bottom',
            },
          },
          ...chartData.options,
        },
      };

      // Generate chart
      const imageBuffer = await canvas.renderToBuffer(configuration, options?.format || 'png');

      const duration = Date.now() - startTime;
      reportLogger.chartGenerated(chartData.type, duration);

      return imageBuffer;

    } catch (error) {
      logger.error('Chart generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate severity distribution pie chart
   */
  async generateSeverityChart(threats: Threat[]): Promise<Buffer> {
    const severityCounts = {
      Critical: threats.filter(t => t.severity === 'critical').length,
      High: threats.filter(t => t.severity === 'high').length,
      Medium: threats.filter(t => t.severity === 'medium').length,
      Low: threats.filter(t => t.severity === 'low').length,
    };

    const chartData: ChartData = {
      type: 'pie',
      title: 'Threat Severity Distribution',
      data: {
        labels: Object.keys(severityCounts),
        datasets: [{
          data: Object.values(severityCounts),
          backgroundColor: [
            '#dc3545', // Critical - Red
            '#fd7e14', // High - Orange
            '#ffc107', // Medium - Yellow
            '#28a745', // Low - Green
          ],
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    };

    return this.generateChart(chartData);
  }

  /**
   * Generate risk matrix heatmap
   */
  async generateRiskMatrix(threats: Threat[]): Promise<Buffer> {
    // Create 5x5 matrix (likelihood x impact)
    const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
    const likelihoodMap: Record<string, number> = {
      'very-low': 0, 'low': 1, 'medium': 2, 'high': 3, 'very-high': 4
    };
    const impactMap: Record<string, number> = {
      'negligible': 0, 'minor': 1, 'moderate': 2, 'major': 3, 'catastrophic': 4
    };

    // Populate matrix
    threats.forEach(threat => {
      const x = likelihoodMap[threat.likelihood] || 2;
      const y = impactMap[threat.impact] || 2;
      matrix[y][x]++;
    });

    // Flatten matrix for heatmap
    const data: any[] = [];
    const labels = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];
    const likelihoodLabels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        data.push({
          x: likelihoodLabels[x],
          y: labels[4 - y], // Reverse for proper display
          v: matrix[4 - y][x],
        });
      }
    }

    // Custom implementation for matrix visualization
    // Since Chart.js doesn't have native heatmap, we'll use a bubble chart
    const chartData: ChartData = {
      type: 'bubble',
      title: 'Risk Matrix (Impact vs Likelihood)',
      data: {
        datasets: [{
          label: 'Threats',
          data: data.map(d => ({
            x: likelihoodLabels.indexOf(d.x),
            y: labels.indexOf(d.y),
            r: d.v > 0 ? Math.sqrt(d.v) * 15 : 0,
          })),
          backgroundColor: (context: any) => {
            const value = context.raw.r / 15;
            const intensity = Math.min(value * value, 1);
            return `rgba(220, 53, 69, ${0.3 + intensity * 0.7})`;
          },
        }],
      },
      options: {
        scales: {
          x: {
            type: 'category',
            labels: likelihoodLabels,
            title: {
              display: true,
              text: 'Likelihood',
            },
          },
          y: {
            type: 'category',
            labels: labels,
            title: {
              display: true,
              text: 'Impact',
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const count = Math.round((context.raw.r / 15) ** 2);
                return `${count} threat${count !== 1 ? 's' : ''}`;
              },
            },
          },
        },
      },
    };

    return this.generateChart(chartData, { width: 800, height: 600 });
  }

  /**
   * Generate threat status bar chart
   */
  async generateStatusChart(threats: Threat[]): Promise<Buffer> {
    const statusCounts = {
      Identified: threats.filter(t => t.status === 'identified').length,
      Analyzed: threats.filter(t => t.status === 'analyzed').length,
      Mitigated: threats.filter(t => t.status === 'mitigated').length,
      Accepted: threats.filter(t => t.status === 'accepted').length,
      Transferred: threats.filter(t => t.status === 'transferred').length,
    };

    const chartData: ChartData = {
      type: 'bar',
      title: 'Threat Status Overview',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          label: 'Number of Threats',
          data: Object.values(statusCounts),
          backgroundColor: [
            '#6c757d', // Identified - Gray
            '#17a2b8', // Analyzed - Info
            '#28a745', // Mitigated - Success
            '#ffc107', // Accepted - Warning
            '#007bff', // Transferred - Primary
          ],
          borderWidth: 1,
          borderColor: '#000',
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    };

    return this.generateChart(chartData);
  }

  /**
   * Generate component risk radar chart
   */
  async generateComponentRiskChart(threatModel: ThreatModelData): Promise<Buffer> {
    const componentData = threatModel.components.map(component => {
      const componentThreats = threatModel.threats.filter(
        t => t.affectedComponents.includes(component.id)
      );
      
      const avgRisk = componentThreats.length > 0
        ? componentThreats.reduce((sum, t) => sum + t.riskScore, 0) / componentThreats.length
        : 0;

      return {
        name: component.name,
        risk: avgRisk,
        count: componentThreats.length,
      };
    });

    const chartData: ChartData = {
      type: 'radar',
      title: 'Component Risk Analysis',
      data: {
        labels: componentData.map(c => c.name),
        datasets: [{
          label: 'Average Risk Score',
          data: componentData.map(c => c.risk),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgb(54, 162, 235)',
          pointBackgroundColor: 'rgb(54, 162, 235)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(54, 162, 235)',
        }],
      },
      options: {
        scales: {
          r: {
            beginAtZero: true,
            max: 10,
            ticks: {
              stepSize: 2,
            },
          },
        },
      },
    };

    return this.generateChart(chartData);
  }

  /**
   * Generate mitigation effectiveness chart
   */
  async generateMitigationChart(mitigations: any[]): Promise<Buffer> {
    const effectivenessGroups = {
      'Very High (90-100%)': mitigations.filter(m => m.effectiveness >= 90).length,
      'High (70-89%)': mitigations.filter(m => m.effectiveness >= 70 && m.effectiveness < 90).length,
      'Medium (50-69%)': mitigations.filter(m => m.effectiveness >= 50 && m.effectiveness < 70).length,
      'Low (30-49%)': mitigations.filter(m => m.effectiveness >= 30 && m.effectiveness < 50).length,
      'Very Low (<30%)': mitigations.filter(m => m.effectiveness < 30).length,
    };

    const chartData: ChartData = {
      type: 'doughnut',
      title: 'Mitigation Effectiveness Distribution',
      data: {
        labels: Object.keys(effectivenessGroups),
        datasets: [{
          data: Object.values(effectivenessGroups),
          backgroundColor: [
            '#28a745', // Very High - Green
            '#20c997', // High - Teal
            '#ffc107', // Medium - Yellow
            '#fd7e14', // Low - Orange
            '#dc3545', // Very Low - Red
          ],
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    };

    return this.generateChart(chartData);
  }

  /**
   * Generate trend line chart
   */
  async generateTrendChart(
    data: Array<{ date: string; value: number }>,
    title: string,
    label: string
  ): Promise<Buffer> {
    const chartData: ChartData = {
      type: 'line',
      title,
      data: {
        labels: data.map(d => d.date),
        datasets: [{
          label,
          data: data.map(d => d.value),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true,
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            display: true,
          },
        },
      },
    };

    return this.generateChart(chartData);
  }

  /**
   * Generate STRIDE category distribution
   */
  async generateSTRIDEChart(threats: Threat[]): Promise<Buffer> {
    const strideCategories = ['Spoofing', 'Tampering', 'Repudiation', 
                             'Information Disclosure', 'Denial of Service', 
                             'Elevation of Privilege'];
    
    const categoryCounts: Record<string, number> = {};
    strideCategories.forEach(cat => {
      categoryCounts[cat] = threats.filter(t => t.category === cat).length;
    });

    const chartData: ChartData = {
      type: 'bar',
      title: 'STRIDE Threat Categories',
      data: {
        labels: strideCategories.map(cat => cat.split(' ').map(w => w[0]).join('')), // Abbreviate
        datasets: [{
          label: 'Number of Threats',
          data: strideCategories.map(cat => categoryCounts[cat]),
          backgroundColor: [
            '#e74c3c', // Spoofing - Red
            '#e67e22', // Tampering - Orange
            '#f39c12', // Repudiation - Yellow
            '#9b59b6', // Information Disclosure - Purple
            '#3498db', // Denial of Service - Blue
            '#1abc9c', // Elevation of Privilege - Turquoise
          ],
          borderWidth: 1,
          borderColor: '#2c3e50',
        }],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    };

    return this.generateChart(chartData, { width: 800, height: 400 });
  }

  /**
   * Generate combined dashboard charts
   */
  async generateDashboard(threatModel: ThreatModelData): Promise<Buffer[]> {
    const charts = await Promise.all([
      this.generateSeverityChart(threatModel.threats),
      this.generateStatusChart(threatModel.threats),
      this.generateRiskMatrix(threatModel.threats),
      this.generateComponentRiskChart(threatModel),
      this.generateSTRIDEChart(threatModel.threats),
    ]);

    return charts;
  }
}