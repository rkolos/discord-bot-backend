import { CommandRegistry } from './command.registry';

const DISCORD_NAME_MAX = 32;
const DISCORD_DESCRIPTION_MAX = 100;

describe('CommandRegistry', () => {
  const registry = new CommandRegistry();

  describe('command JSON schema validity', () => {
    it('getAllCommands returns non-empty array', () => {
      const commands = registry.getAllCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('each command data() has required name and description', () => {
      const commands = registry.getAllCommands();
      for (const cmd of commands) {
        const data = cmd.data();
        expect(data).toBeDefined();
        expect(typeof data.name).toBe('string');
        expect(data.name.length).toBeGreaterThan(0);
        expect(data.name.length).toBeLessThanOrEqual(DISCORD_NAME_MAX);
        expect(typeof data.description).toBe('string');
        expect(data.description.length).toBeGreaterThan(0);
        expect(data.description.length).toBeLessThanOrEqual(DISCORD_DESCRIPTION_MAX);
      }
    });

    it('each command has valid type (1 for Chat Input)', () => {
      const commands = registry.getAllCommands();
      for (const cmd of commands) {
        const data = cmd.data();
        expect(data.type === undefined || data.type === 1).toBe(true);
      }
    });

    it('getByName returns command for registered names', () => {
      expect(registry.getByName('ping')).toBeDefined();
      expect(registry.getByName('stats')).toBeDefined();
      expect(registry.getByName('unknown')).toBeUndefined();
    });
  });
});
