-- Migration: 008_seed_data.sql
-- Description: Initial seed data for the application
-- Date: 2025-01-09

-- Default system roles
INSERT INTO roles (name, description, is_system, permissions) VALUES
('system_admin', 'System Administrator - Full access', true, 
 '["*"]'::jsonb),
('org_owner', 'Organization Owner - Full organization access', true, 
 '["org:*", "project:*", "threat_model:*", "user:*", "report:*"]'::jsonb),
('org_admin', 'Organization Administrator', true, 
 '["org:read", "org:update", "project:*", "threat_model:*", "user:read", "user:invite", "report:*"]'::jsonb),
('project_manager', 'Project Manager', true, 
 '["project:*", "threat_model:*", "threat:*", "report:*", "user:read"]'::jsonb),
('security_analyst', 'Security Analyst', true, 
 '["project:read", "threat_model:*", "threat:*", "report:*", "library:read"]'::jsonb),
('developer', 'Developer', true, 
 '["project:read", "threat_model:read", "threat:read", "threat:comment", "report:read"]'::jsonb),
('reviewer', 'Reviewer', true, 
 '["project:read", "threat_model:read", "threat_model:review", "threat:read", "report:read"]'::jsonb),
('viewer', 'Viewer - Read only access', true, 
 '["project:read", "threat_model:read", "threat:read", "report:read"]'::jsonb);

-- Default threat libraries
INSERT INTO threat_libraries (name, version, type, source, methodology, description) VALUES
('OWASP Top 10', '2021', 'standard', 'OWASP', 'STRIDE', 
 'The OWASP Top 10 is a standard awareness document for developers and web application security'),
('OWASP Top 10', '2017', 'standard', 'OWASP', 'STRIDE', 
 'Previous version of OWASP Top 10 for legacy support'),
('MITRE ATT&CK Enterprise', '13.1', 'standard', 'MITRE', NULL, 
 'Adversarial Tactics, Techniques, and Common Knowledge for enterprise networks'),
('MITRE CAPEC', '3.9', 'standard', 'MITRE', NULL, 
 'Common Attack Pattern Enumeration and Classification'),
('CWE Top 25', '2023', 'standard', 'MITRE', NULL, 
 'Common Weakness Enumeration - Most Dangerous Software Weaknesses'),
('Cloud Security Alliance', '4.0', 'standard', 'CSA', NULL, 
 'Top threats to cloud computing'),
('STRIDE Threats', '1.0', 'standard', 'Microsoft', 'STRIDE', 
 'Standard STRIDE threat categories'),
('LINDDUN Privacy Threats', '2.0', 'standard', 'LINDDUN', 'LINDDUN', 
 'Privacy threat modeling framework threats');

-- Default report templates
INSERT INTO report_templates (name, type, description, is_default, template_content) VALUES
('Executive Summary', 'executive', 
 'High-level threat modeling report suitable for executives and management', 
 true, 
 '# Executive Summary\n\n## Overview\n{{project_overview}}\n\n## Key Findings\n{{key_findings}}\n\n## Risk Summary\n{{risk_summary}}\n\n## Recommendations\n{{recommendations}}'),
('Technical Threat Report', 'technical', 
 'Detailed technical threat modeling report with full threat analysis', 
 true,
 '# Technical Threat Modeling Report\n\n## System Architecture\n{{architecture}}\n\n## Threat Analysis\n{{threats}}\n\n## Mitigations\n{{mitigations}}\n\n## Technical Details\n{{technical_details}}'),
('STRIDE Analysis Report', 'threat_model', 
 'STRIDE methodology-based threat analysis report', 
 true,
 '# STRIDE Threat Analysis\n\n## Spoofing Threats\n{{spoofing}}\n\n## Tampering Threats\n{{tampering}}\n\n## Repudiation Threats\n{{repudiation}}\n\n## Information Disclosure\n{{disclosure}}\n\n## Denial of Service\n{{dos}}\n\n## Elevation of Privilege\n{{privilege}}'),
('Compliance Assessment', 'compliance', 
 'Compliance-focused threat modeling and security assessment report', 
 true,
 '# Compliance Assessment Report\n\n## Compliance Framework\n{{framework}}\n\n## Assessment Results\n{{results}}\n\n## Gap Analysis\n{{gaps}}\n\n## Remediation Plan\n{{remediation}}'),
('Privacy Impact Assessment', 'privacy', 
 'Privacy impact assessment based on LINDDUN methodology', 
 true,
 '# Privacy Impact Assessment\n\n## Data Processing\n{{processing}}\n\n## Privacy Threats\n{{privacy_threats}}\n\n## Privacy Controls\n{{controls}}\n\n## Recommendations\n{{recommendations}}');

-- Common compliance requirements
INSERT INTO compliance_requirements (framework, requirement_id, title, category, priority, description) VALUES
-- GDPR
('GDPR', 'Art.25', 'Data protection by design and by default', 'Privacy', 'high',
 'The controller shall implement appropriate technical and organisational measures for ensuring that, by default, only personal data which are necessary for each specific purpose of the processing are processed'),
('GDPR', 'Art.32', 'Security of processing', 'Security', 'high',
 'The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk'),
('GDPR', 'Art.35', 'Data protection impact assessment', 'Privacy', 'high',
 'Where a type of processing is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall carry out an assessment of the impact'),

-- PCI-DSS
('PCI-DSS', '6.3', 'Develop internal and external software applications securely', 'Security', 'high',
 'Develop internal and external software applications (including web-based administrative access to applications) securely'),
('PCI-DSS', '6.5', 'Address common coding vulnerabilities', 'Security', 'high',
 'Address common coding vulnerabilities in software-development processes'),
('PCI-DSS', '11.3', 'Implement a methodology for penetration testing', 'Security', 'medium',
 'Implement a methodology for penetration testing that includes external and internal penetration testing'),

-- HIPAA
('HIPAA', '164.308(a)(1)', 'Security Management Process', 'Security', 'high',
 'Implement policies and procedures to prevent, detect, contain, and correct security violations'),
('HIPAA', '164.308(a)(5)', 'Workforce Training and Management', 'Security', 'medium',
 'Implement a security awareness and training program for all members of its workforce'),
('HIPAA', '164.312(a)(1)', 'Access Control', 'Security', 'high',
 'Implement technical policies and procedures for electronic information systems that maintain electronic protected health information'),

-- SOC 2
('SOC2', 'CC6.1', 'Logical and Physical Access Controls', 'Security', 'high',
 'The entity implements logical access security software, infrastructure, and architectures over protected information assets'),
('SOC2', 'CC7.2', 'System Monitoring', 'Security', 'medium',
 'The entity monitors system components and the operation of those components for anomalies'),
('SOC2', 'CC9.2', 'Confidentiality Commitments', 'Privacy', 'high',
 'The entity identifies and maintains confidentiality commitments that are communicated to internal and external users');

-- Sample OWASP threats
INSERT INTO library_threats (library_id, threat_id, name, category, severity, description, cwe_ids) 
SELECT 
    id, 
    'A01:2021',
    'Broken Access Control',
    'Authorization',
    'high',
    'Access control enforces policy such that users cannot act outside of their intended permissions. Failures typically lead to unauthorized information disclosure, modification, or destruction of all data or performing a business function outside the user''s limits.',
    ARRAY['CWE-200', 'CWE-285', 'CWE-352']
FROM threat_libraries WHERE name = 'OWASP Top 10' AND version = '2021';

INSERT INTO library_threats (library_id, threat_id, name, category, severity, description, cwe_ids)
SELECT 
    id,
    'A02:2021',
    'Cryptographic Failures',
    'Cryptography',
    'high',
    'The first thing is to determine the protection needs of data in transit and at rest. For example, passwords, credit card numbers, health records, personal information, and business secrets require extra protection.',
    ARRAY['CWE-259', 'CWE-327', 'CWE-331']
FROM threat_libraries WHERE name = 'OWASP Top 10' AND version = '2021';

INSERT INTO library_threats (library_id, threat_id, name, category, severity, description, cwe_ids)
SELECT 
    id,
    'A03:2021',
    'Injection',
    'Input Validation',
    'high',
    'An application is vulnerable to attack when user-supplied data is not validated, filtered, or sanitized by the application.',
    ARRAY['CWE-79', 'CWE-89', 'CWE-73']
FROM threat_libraries WHERE name = 'OWASP Top 10' AND version = '2021';

-- Sample STRIDE threats
INSERT INTO library_threats (library_id, threat_id, name, category, severity, description)
SELECT 
    id,
    'S001',
    'Authentication Bypass',
    'Spoofing',
    'high',
    'An attacker could bypass authentication mechanisms to impersonate a legitimate user'
FROM threat_libraries WHERE name = 'STRIDE Threats';

INSERT INTO library_threats (library_id, threat_id, name, category, severity, description)
SELECT 
    id,
    'T001',
    'Data Tampering in Transit',
    'Tampering',
    'high',
    'An attacker could modify data while it is being transmitted between components'
FROM threat_libraries WHERE name = 'STRIDE Threats';

-- Privacy controls
INSERT INTO privacy_controls (control_id, name, category, description, pet_technologies) VALUES
('PC001', 'Data Minimization', 'data_protection', 
 'Collect and process only the minimum amount of personal data necessary for the specified purpose',
 ARRAY['anonymization', 'pseudonymization']),
('PC002', 'Purpose Limitation', 'data_governance', 
 'Personal data should only be collected for specified, explicit and legitimate purposes',
 ARRAY['access_control', 'policy_enforcement']),
('PC003', 'Differential Privacy', 'technical', 
 'Add statistical noise to datasets to protect individual privacy while maintaining utility',
 ARRAY['differential_privacy']),
('PC004', 'Homomorphic Encryption', 'technical', 
 'Enable computation on encrypted data without decrypting it',
 ARRAY['homomorphic_encryption']),
('PC005', 'K-Anonymity', 'technical', 
 'Ensure each record is indistinguishable from at least k-1 other records',
 ARRAY['k_anonymity', 'l_diversity']);

-- Privacy patterns
INSERT INTO privacy_patterns (name, category, description, linddun_categories) VALUES
('Informed Consent Pattern', 'consent',
 'Ensure users are fully informed about data processing and provide explicit consent',
 ARRAY['U', 'N2']),
('Data Anonymization Pattern', 'data_protection',
 'Remove or obscure personal identifiers from datasets',
 ARRAY['I', 'L']),
('Privacy Dashboard Pattern', 'transparency',
 'Provide users with a centralized view of their privacy settings and data usage',
 ARRAY['U']),
('Selective Disclosure Pattern', 'data_minimization',
 'Allow users to selectively share only necessary information',
 ARRAY['D2', 'I']);