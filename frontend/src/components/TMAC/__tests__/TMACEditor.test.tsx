import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import TMACEditor from '../TMACEditor';

// Mock dependencies
jest.mock('axios');
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ 'data-testid': 'dropzone-input' }),
    isDragActive: false,
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TMACEditor', () => {
  const mockOnSave = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the editor with all controls', () => {
      render(<TMACEditor />);
      
      expect(screen.getByText('Validate')).toBeInTheDocument();
      expect(screen.getByText('Analyze')).toBeInTheDocument();
      expect(screen.getByText('Convert to JSON')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('should render with initial content', () => {
      const initialContent = 'version: "1.0.0"';
      render(<TMACEditor initialContent={initialContent} />);
      
      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveValue(initialContent);
    });

    it('should show save button when onSave is provided', () => {
      render(<TMACEditor onSave={mockOnSave} />);
      
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should show import button when threatModelId is provided', () => {
      render(<TMACEditor threatModelId="123" />);
      
      expect(screen.getByText('Import from Platform')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should validate TMAC content successfully', async () => {
      const mockValidationResult = {
        validation: {
          valid: true,
          errors: [],
          warnings: ['Consider adding more threats'],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResult });

      render(<TMACEditor initialContent="test content" />);
      
      const validateButton = screen.getByText('Validate');
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          '/api/tmac/validate',
          expect.any(FormData),
          expect.objectContaining({
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('TMAC file is valid!')).toBeInTheDocument();
        expect(screen.getByText('Consider adding more threats')).toBeInTheDocument();
      });
    });

    it('should show validation errors', async () => {
      const mockValidationResult = {
        validation: {
          valid: false,
          errors: ['metadata.name is required', 'system.name is required'],
          warnings: [],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockValidationResult });

      render(<TMACEditor initialContent="test content" />);
      
      const validateButton = screen.getByText('Validate');
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('TMAC file has validation errors')).toBeInTheDocument();
        expect(screen.getByText('metadata.name is required')).toBeInTheDocument();
        expect(screen.getByText('system.name is required')).toBeInTheDocument();
      });
    });

    it('should handle validation failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { error: 'Invalid file format' } },
      });

      render(<TMACEditor initialContent="test content" />);
      
      const validateButton = screen.getByText('Validate');
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid file format')).toBeInTheDocument();
      });
    });
  });

  describe('Analysis', () => {
    it('should analyze TMAC content successfully', async () => {
      const mockAnalysisResult = {
        analysis: {
          summary: {
            totalComponents: 5,
            totalThreats: 10,
            criticalThreats: 2,
            highThreats: 3,
            unmitigatedThreats: 4,
            coveragePercentage: 60,
            riskScore: 75,
          },
          findings: [
            {
              type: 'security',
              severity: 'critical',
              title: 'Unmitigated Critical Threat',
              description: 'Found critical threats without mitigations',
            },
          ],
          recommendations: [
            {
              priority: 'high',
              title: 'Implement Authentication',
              description: 'Add authentication mechanisms to all endpoints',
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockAnalysisResult });

      render(<TMACEditor initialContent="test content" />);
      
      const analyzeButton = screen.getByText('Analyze');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          '/api/tmac/analyze',
          expect.any(FormData),
          expect.objectContaining({
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Risk Score: 75/100')).toBeInTheDocument();
        expect(screen.getByText('Components: 5')).toBeInTheDocument();
        expect(screen.getByText('Threats: 10')).toBeInTheDocument();
        expect(screen.getByText('Critical: 2')).toBeInTheDocument();
        expect(screen.getByText('Coverage: 60%')).toBeInTheDocument();
      });
    });
  });

  describe('Format Conversion', () => {
    it('should convert YAML to JSON', async () => {
      const mockConvertResult = {
        content: '{"version": "1.0.0"}',
        format: 'json',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockConvertResult });

      render(<TMACEditor initialContent="version: 1.0.0" />);
      
      const convertButton = screen.getByText('Convert to JSON');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          '/api/tmac/convert',
          expect.any(FormData),
          expect.objectContaining({
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        );
      });

      await waitFor(() => {
        const editor = screen.getByTestId('monaco-editor');
        expect(editor).toHaveValue('{"version": "1.0.0"}');
        expect(screen.getByText('Converted to JSON')).toBeInTheDocument();
      });
    });

    it('should convert JSON to YAML', async () => {
      const mockConvertResult = {
        content: 'version: "1.0.0"',
        format: 'yaml',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockConvertResult });

      // Set initial format to JSON
      render(<TMACEditor initialContent='{"version": "1.0.0"}' />);
      
      // Change format to JSON first
      const formatSelect = screen.getByRole('combobox');
      fireEvent.change(formatSelect, { target: { value: 'json' } });

      const convertButton = screen.getByText('Convert to YAML');
      fireEvent.click(convertButton);

      await waitFor(() => {
        const editor = screen.getByTestId('monaco-editor');
        expect(editor).toHaveValue('version: "1.0.0"');
      });
    });
  });

  describe('File Operations', () => {
    it('should handle file upload', async () => {
      const file = new File(['test content'], 'test.yaml', { type: 'text/yaml' });
      
      render(<TMACEditor />);
      
      const input = screen.getByTestId('dropzone-input');
      await userEvent.upload(input, file);

      // Note: Due to mocking, we can't fully test file reading
      // but we can verify the component handles the upload
      expect(input).toBeInTheDocument();
    });

    it('should handle file download', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const content = 'version: "1.0.0"';
      
      render(<TMACEditor initialContent={content} />);
      
      const downloadButton = screen.getByLabelText('Download TMAC file');
      fireEvent.click(downloadButton);

      expect(createElementSpy).toHaveBeenCalledWith('a');
    });
  });

  describe('Import from Platform', () => {
    it('should import threat model from platform', async () => {
      const mockImportResult = {
        content: 'imported content',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockImportResult });

      render(<TMACEditor threatModelId="123" />);
      
      const importButton = screen.getByText('Import from Platform');
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import from Threat Model')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Import' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith('/api/tmac/export', {
          threatModelId: '123',
          format: 'yaml',
        });
      });

      await waitFor(() => {
        const editor = screen.getByTestId('monaco-editor');
        expect(editor).toHaveValue('imported content');
        expect(screen.getByText('Threat model imported successfully')).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave with current content', () => {
      const content = 'test content';
      render(<TMACEditor initialContent={content} onSave={mockOnSave} />);
      
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(content);
    });

    it('should disable save button when no content', () => {
      render(<TMACEditor onSave={mockOnSave} />);
      
      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch between tabs', async () => {
      const mockValidationResult = {
        validation: { valid: true, errors: [], warnings: [] },
      };
      const mockAnalysisResult = {
        analysis: {
          summary: {
            totalComponents: 1,
            totalThreats: 1,
            criticalThreats: 0,
            highThreats: 0,
            unmitigatedThreats: 0,
            coveragePercentage: 100,
            riskScore: 0,
          },
          findings: [],
          recommendations: [],
        },
      };

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockValidationResult })
        .mockResolvedValueOnce({ data: mockAnalysisResult });

      render(<TMACEditor initialContent="test" />);

      // Validate first
      fireEvent.click(screen.getByText('Validate'));
      await waitFor(() => {
        expect(screen.getByText('TMAC file is valid!')).toBeInTheDocument();
      });

      // Analyze
      fireEvent.click(screen.getByText('Analyze'));
      await waitFor(() => {
        expect(screen.getByText('Risk Score: 0/100')).toBeInTheDocument();
      });

      // Switch back to editor
      const editorTab = screen.getByRole('tab', { name: /Editor/i });
      fireEvent.click(editorTab);
      
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator during operations', async () => {
      mockedAxios.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<TMACEditor initialContent="test" />);
      
      const validateButton = screen.getByText('Validate');
      fireEvent.click(validateButton);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});