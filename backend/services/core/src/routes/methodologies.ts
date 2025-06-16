import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { MethodologyType } from '../types';

export function createMethodologyRouter(): Router {
  const router = Router();

  // Get all available methodologies
  router.get('/',
    asyncHandler(async (req: Request, res: Response) => {
      const methodologies = [
        {
          type: MethodologyType.STRIDE,
          name: 'STRIDE',
          description: 'Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege',
          strengths: [
            'Well-established and widely adopted',
            'Comprehensive coverage of common threats',
            'Clear categorization system',
            'Good for technical threat modeling'
          ],
          best_for: ['Application security', 'Network security', 'API security'],
          time_required: 'Medium',
          expertise_required: 'medium' as const
        },
        {
          type: MethodologyType.PASTA,
          name: 'PASTA',
          description: 'Process for Attack Simulation and Threat Analysis',
          strengths: [
            'Business-focused approach',
            'Risk-centric methodology',
            'Aligns with business objectives',
            'Comprehensive 7-stage process'
          ],
          best_for: ['Business-critical applications', 'Enterprise systems', 'Risk assessment'],
          time_required: 'High',
          expertise_required: 'high' as const
        },
        {
          type: MethodologyType.LINDDUN,
          name: 'LINDDUN',
          description: 'Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance',
          strengths: [
            'Privacy-focused methodology',
            'GDPR compliance support',
            'Systematic privacy threat analysis',
            'Data flow oriented'
          ],
          best_for: ['Privacy-sensitive applications', 'Personal data processing', 'GDPR compliance'],
          time_required: 'High',
          expertise_required: 'high' as const
        },
        {
          type: MethodologyType.VAST,
          name: 'VAST',
          description: 'Visual, Agile, and Simple Threat modeling',
          strengths: [
            'Scalable approach',
            'Integrates with DevOps',
            'Automated threat generation',
            'Visual threat modeling'
          ],
          best_for: ['Agile development', 'DevSecOps', 'Continuous deployment'],
          time_required: 'Low',
          expertise_required: 'low' as const
        },
        {
          type: MethodologyType.DREAD,
          name: 'DREAD',
          description: 'Damage, Reproducibility, Exploitability, Affected users, Discoverability',
          strengths: [
            'Simple risk rating system',
            'Quantitative approach',
            'Easy to understand',
            'Quick assessment'
          ],
          best_for: ['Quick risk assessment', 'Vulnerability prioritization', 'Small projects'],
          time_required: 'Low',
          expertise_required: 'low' as const
        }
      ];

      res.json({
        success: true,
        data: methodologies
      });
    })
  );

  // Get specific methodology details
  router.get('/:methodologyType',
    asyncHandler(async (req: Request, res: Response) => {
      const { methodologyType } = req.params;
      
      // This would typically fetch from database
      const methodologyDetails = {
        STRIDE: {
          type: MethodologyType.STRIDE,
          name: 'STRIDE',
          categories: [
            {
              id: 'spoofing',
              name: 'Spoofing',
              description: 'An attacker pretends to be someone or something else',
              examples: [
                'Spoofing user identity',
                'IP address spoofing',
                'Email spoofing'
              ],
              common_mitigations: [
                'Strong authentication',
                'Multi-factor authentication',
                'Digital certificates'
              ]
            },
            {
              id: 'tampering',
              name: 'Tampering',
              description: 'Unauthorized modification of data or systems',
              examples: [
                'Modifying data in transit',
                'Changing configuration files',
                'SQL injection'
              ],
              common_mitigations: [
                'Input validation',
                'Integrity checks',
                'Access controls'
              ]
            },
            {
              id: 'repudiation',
              name: 'Repudiation',
              description: 'Denying actions or transactions',
              examples: [
                'Denying a transaction occurred',
                'Claiming not to have received data',
                'Disputing actions taken'
              ],
              common_mitigations: [
                'Audit logging',
                'Digital signatures',
                'Timestamps'
              ]
            },
            {
              id: 'information_disclosure',
              name: 'Information Disclosure',
              description: 'Exposing information to unauthorized parties',
              examples: [
                'Data breaches',
                'Information leakage',
                'Unauthorized access to files'
              ],
              common_mitigations: [
                'Encryption',
                'Access controls',
                'Data classification'
              ]
            },
            {
              id: 'denial_of_service',
              name: 'Denial of Service',
              description: 'Making systems or services unavailable',
              examples: [
                'DDoS attacks',
                'Resource exhaustion',
                'Crashing services'
              ],
              common_mitigations: [
                'Rate limiting',
                'Resource quotas',
                'Redundancy'
              ]
            },
            {
              id: 'elevation_of_privilege',
              name: 'Elevation of Privilege',
              description: 'Gaining unauthorized access or permissions',
              examples: [
                'Privilege escalation',
                'Buffer overflows',
                'Cross-site scripting'
              ],
              common_mitigations: [
                'Principle of least privilege',
                'Input validation',
                'Security boundaries'
              ]
            }
          ]
        }
      };

      const details = methodologyDetails[methodologyType as keyof typeof methodologyDetails];
      
      if (!details) {
        res.status(404).json({
          success: false,
          error: 'Methodology not found'
        });
        return;
      }

      res.json({
        success: true,
        data: details
      });
    })
  );

  // Get methodology recommendation based on project type
  router.post('/recommend',
    asyncHandler(async (req: Request, res: Response) => {
      const {
        project_type,
        industry,
        compliance_requirements,
        team_expertise,
        time_constraints
      } = req.body;

      // Simple recommendation logic (would be more sophisticated in production)
      let recommended = MethodologyType.STRIDE;
      let alternatives = [MethodologyType.PASTA, MethodologyType.VAST];
      let reasoning = 'STRIDE is a good general-purpose methodology';

      if (compliance_requirements?.includes('GDPR') || 
          compliance_requirements?.includes('privacy')) {
        recommended = MethodologyType.LINDDUN;
        reasoning = 'LINDDUN is specifically designed for privacy threat modeling';
        alternatives = [MethodologyType.STRIDE, MethodologyType.PASTA];
      } else if (project_type === 'agile' || time_constraints === 'tight') {
        recommended = MethodologyType.VAST;
        reasoning = 'VAST is designed for agile environments and quick assessments';
        alternatives = [MethodologyType.DREAD, MethodologyType.STRIDE];
      } else if (project_type === 'enterprise' || industry === 'finance') {
        recommended = MethodologyType.PASTA;
        reasoning = 'PASTA provides comprehensive business-focused threat analysis';
        alternatives = [MethodologyType.STRIDE, MethodologyType.OCTAVE];
      }

      res.json({
        success: true,
        data: {
          recommendation: {
            primary: recommended,
            alternatives,
            reasoning,
            factors_considered: [
              project_type && `Project type: ${project_type}`,
              industry && `Industry: ${industry}`,
              compliance_requirements?.length && `Compliance: ${compliance_requirements.join(', ')}`,
              team_expertise && `Team expertise: ${team_expertise}`,
              time_constraints && `Time constraints: ${time_constraints}`
            ].filter(Boolean)
          }
        }
      });
    })
  );

  return router;
}