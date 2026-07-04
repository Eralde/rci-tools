import {describe, expect, it} from 'vitest';
import {RciResponseHelper} from '../../../src/rci-manager/helpers/rci-response.helper';
import type {RciError} from '../../../src/rci-manager/helpers/rci-response.types';

describe('RciResponseHelper', () => {
  describe('hasErrors', () => {
    it('should return false for a plain success response with no error field', () => {
      const response = {hostname: 'Keenetic-1575', cpuload: 3};
      expect(RciResponseHelper.hasErrors(response)).toBe(false);
    });

    it('should return false for an empty object', () => {
      expect(RciResponseHelper.hasErrors({})).toBe(false);
    });

    it('should return false for a status array containing only "message" statuses', () => {
      const response = {
        'status': [
          {
            'status': 'message',
            'code': '6553601',
            'ident': 'Network::Interface::Repository',
            'message': '"PPTP0" interface created.',
          },
        ],
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(false);
    });

    it('should return false for a status field that is not "error"', () => {
      const response = {'status': 'ok', 'body': {}};
      expect(RciResponseHelper.hasErrors(response)).toBe(false);
    });

    it('should return true when status field equals "error" at top level', () => {
      const response = {
        'status': 'error',
        'code': '7405600',
        'message': 'no such command: foo.',
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(true);
    });

    it('should return true when an "error" property exists at top level', () => {
      const response = {'error': 'something went wrong', 'message': 'details'};
      expect(RciResponseHelper.hasErrors(response)).toBe(true);
    });

    it('should detect errors nested inside objects', () => {
      const response = {
        'Bridge1': {
          'up': {
            'status': [
              {
                'status': 'error',
                'code': '72155286',
                'ident': 'Network::Interface::Base',
                'message': '"Bridge1": interface is down.',
              },
            ],
          },
        },
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(true);
    });

    it('should detect errors nested inside arrays', () => {
      const response = [
        {hostname: 'Keenetic-1575'},
        {'status': 'error', 'code': '99999', 'message': 'nested error in array'},
      ];
      expect(RciResponseHelper.hasErrors(response)).toBe(true);
    });

    it('should detect errors deeply nested', () => {
      const response = {
        'show': {
          'rc': {
            'interface': {
              'Bridge1': {
                'description': {
                  'status': [
                    {
                      'status': 'error',
                      'code': '999999',
                      'ident': 'Test',
                      'message': 'deep error',
                    },
                  ],
                },
              },
            },
          },
        },
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(true);
    });

    it('should return false for deeply nested success objects', () => {
      const response = {
        'show': {
          'rc': {
            'interface': {
              'Bridge1': {'description': 'Guest network'},
            },
          },
        },
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(false);
    });

    it('should detect errors within items of a status array (error status inside status array)', () => {
      const response = {
        'status': [
          {
            'status': 'error',
            'code': '7405600',
            'ident': 'Command::Base',
            'message': 'no such command: foo.',
          },
        ],
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(true);
    });

    it('should return false for a response with status array only containing warnings', () => {
      const response = {
        'status': [
          {
            'status': 'warning',
            'code': '11111',
            'ident': 'Module',
            'message': 'something to note.',
          },
        ],
      };
      expect(RciResponseHelper.hasErrors(response)).toBe(false);
    });

    it('should handle primitive values gracefully', () => {
      expect(RciResponseHelper.hasErrors(null as any)).toBe(false);
      expect(RciResponseHelper.hasErrors(undefined as any)).toBe(false);
      expect(RciResponseHelper.hasErrors('string' as any)).toBe(false);
      expect(RciResponseHelper.hasErrors(42 as any)).toBe(false);
    });
  });

  describe('hasCode', () => {
    it('should find a status code at top level', () => {
      const response = {
        'status': [
          {
            'status': 'message',
            'code': '6553601',
            'ident': 'Network::Interface::Repository',
            'message': '"PPTP0" interface created.',
          },
        ],
      };
      expect(RciResponseHelper.hasCode('6553601', response)).toBe(true);
    });

    it('should return false for a code not present', () => {
      const response = {
        'status': [
          {
            'status': 'message',
            'code': '6553601',
            'ident': 'Network::Interface::Repository',
            'message': '"PPTP0" interface created.',
          },
        ],
      };
      expect(RciResponseHelper.hasCode('999999', response)).toBe(false);
    });

    it('should find a status code nested in an object', () => {
      const response = {
        'Bridge1': {
          'description': {
            'status': [
              {
                'status': 'message',
                'code': '72155140',
                'ident': 'Network::Interface::Base',
                'message': '"Bridge1": description saved.',
              },
            ],
          },
        },
      };
      expect(RciResponseHelper.hasCode('72155140', response)).toBe(true);
    });

    it('should find a status code in a complex multi-command response', () => {
      const response = [
        {
          'interface': {
            'status': [{'status': 'message', 'code': '6553601', 'ident': '...', 'message': 'created.'}],
            'ip': {
              'global': {
                'status': [{'status': 'message', 'code': '72746280', 'ident': '...', 'message': 'order is 0.'}],
              },
            },
          },
        },
        {},
        {
          'interface': {
            'ping-check': {
              'profile': {
                'status': [{'status': 'message', 'code': '41615363', 'ident': '...', 'message': 'set profile.'}],
              },
            },
          },
        },
        {
          'system': {
            'configuration': {
              'save': {
                'status': [{'status': 'message', 'code': '8912996', 'ident': '...', 'message': 'saving.'}],
              },
            },
          },
        },
      ];
      expect(RciResponseHelper.hasCode('8912996', response)).toBe(true);
    });

    it('should return false for empty response', () => {
      expect(RciResponseHelper.hasCode('123456', {})).toBe(false);
    });

    it('should return false for response without status arrays', () => {
      const response = {hostname: 'Keenetic', cpuload: 3};
      expect(RciResponseHelper.hasCode('6553601', response)).toBe(false);
    });
  });

  describe('getErrors', () => {
    it('should return empty object for a success response', () => {
      const response = {hostname: 'Keenetic-1575', cpuload: 3};
      expect(RciResponseHelper.getErrors(response)).toEqual({});
    });

    it('should return empty object for an empty response', () => {
      expect(RciResponseHelper.getErrors({})).toEqual({});
    });

    it('should collect a single error from top-level error field', () => {
      const response = {
        'error': 'command_failed',
        'message': 'No such command',
        'code': '7405600',
      };
      const expected: Record<string, RciError> = {
        '': {error: 'command_failed', message: 'No such command', code: '7405600'},
      };
      expect(RciResponseHelper.getErrors(response)).toEqual(expected);
    });

    it('should collect a single error from top-level status="error" without explicit error field', () => {
      const response = {
        'status': 'error',
        'message': 'Something went wrong',
        'code': '99999',
      };
      const expected: Record<string, RciError> = {
        '': {error: '', message: 'Something went wrong', code: '99999'},
      };
      expect(RciResponseHelper.getErrors(response)).toEqual(expected);
    });

    it('should collect nested errors with their paths', () => {
      const response = {
        'Bridge1': {
          'up': {
            'status': [
              {
                'status': 'error',
                'code': '72155286',
                'ident': 'Network::Interface::Base',
                'message': '"Bridge1": interface is down.',
              },
            ],
          },
        },
      };
      const errors = RciResponseHelper.getErrors(response);
      expect(Object.keys(errors).length).toBeGreaterThanOrEqual(1);

      const errorPaths = Object.keys(errors);
      const errorValues = Object.values(errors);
      expect(errorValues.some((e) => e.code === '72155286')).toBe(true);
      expect(errorValues.some((e) => e.message === '"Bridge1": interface is down.')).toBe(true);
    });

    it('should collect errors from a multi-command batch response', () => {
      const response = [
        {
          'error': 'first_error',
          'code': '100',
          'message': 'First failed',
        },
        {hostname: 'ok'},
        {
          'show': {
            'version': {
              'status': 'error',
              'code': '200',
              'message': 'Version lookup failed',
            },
          },
        },
      ];
      const errors = RciResponseHelper.getErrors(response);
      const codes = Object.values(errors).map((e) => e.code);
      expect(codes).toContain('100');
      expect(codes).toContain('200');
    });

    it('should omit specified error codes', () => {
      const response = [
        {
          'error': 'first',
          'code': '100',
          'message': 'First',
        },
        {
          'error': 'second',
          'code': '200',
          'message': 'Second',
        },
        {
          'error': 'third',
          'code': '300',
          'message': 'Third',
        },
      ];
      const errors = RciResponseHelper.getErrors(response, ['100', '300']);
      const codes = Object.values(errors).map((e) => e.code);
      expect(codes).toContain('200');
      expect(codes).not.toContain('100');
      expect(codes).not.toContain('300');
    });

    it('should return empty object when all errors are omitted', () => {
      const response = {
        'error': 'test',
        'code': '123',
        'message': 'Test error',
      };
      expect(RciResponseHelper.getErrors(response, ['123'])).toEqual({});
    });

    it('should handle deeply nested error responses matching RCI API patterns', () => {
      const response = {
        'interface': {
          'PPTP0': {
            'up': {
              'error': 'interface_cannot_up',
              'code': '90001',
              'message': 'Interface cannot go up: no carrier',
            },
          },
        },
      };
      const errors = RciResponseHelper.getErrors(response);
      const errorValues = Object.values(errors);
      expect(errorValues.length).toBeGreaterThan(0);
      expect(errorValues[0].code).toBe('90001');
    });

    it('should handle responses that have both errors and successful statuses mixed', () => {
      const response = {
        'interface': {
          'status': [
            {'status': 'message', 'code': '6553601', 'message': 'created.'},
          ],
          'ip': {
            'global': {
              'status': [
                {'status': 'error', 'code': '99999', 'message': 'Failed to set global IP.'},
              ],
            },
          },
        },
      };
      const errors = RciResponseHelper.getErrors(response);
      expect(errors).not.toEqual({});
      const codes = Object.values(errors).map((e) => e.code);
      expect(codes).toContain('99999');
      expect(codes).not.toContain('6553601');
    });

    it('should preserve error paths correctly', () => {
      const response = {
        'interface': {
          'Bridge1': {
            'description': {
              'error': 'bad_value',
              'code': '77777',
              'message': 'Invalid description value',
            },
          },
        },
      };
      const errors = RciResponseHelper.getErrors(response);
      const path = Object.keys(errors)[0];
      // path should not start with "body."
      expect(path).toBe('interface.Bridge1.description');
    });

    it('should handle primitive values gracefully and return empty', () => {
      expect(RciResponseHelper.getErrors(null as any)).toEqual({});
      expect(RciResponseHelper.getErrors(undefined as any)).toEqual({});
      expect(RciResponseHelper.getErrors('error string' as any)).toEqual({});
      expect(RciResponseHelper.getErrors(42 as any)).toEqual({});
    });
  });
});
