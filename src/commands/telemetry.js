import { createInterface } from 'readline';
import userConfig from '#src/core/user-config.js';
import { ErrorHandler, SpecJetError } from '#src/core/errors.js';

/**
 * Display telemetry consent prompt and get user response
 * @returns {Promise<boolean>} True if user consents to telemetry
 */
async function promptForConsent() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n📊 Help improve SpecJet');
    console.log('SpecJet can collect anonymous usage data to help improve the tool:');
    console.log('- Commands used (init, generate, mock)');
    console.log('- Success/error rates');
    console.log('- CLI version and platform');
    console.log('- No personal data, project names, or file contents\n');

    rl.question('Enable anonymous telemetry? [y/N]: ', (answer) => {
      rl.close();
      const consent = answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
      resolve(consent);
    });
  });
}

/**
 * Display telemetry disable confirmation
 * @returns {Promise<boolean>} True if user confirms disable
 */
async function confirmDisable() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n🔒 Disable Telemetry');
    console.log('This will stop all anonymous usage data collection.');
    console.log('You can re-enable telemetry anytime with: specjet telemetry enable\n');

    rl.question('Disable telemetry? [y/N]: ', (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
      resolve(confirmed);
    });
  });
}

/**
 * Enable telemetry tracking
 */
async function enableTelemetry(options = {}) {
  try {
    // Check if already enabled
    const isEnabled = await userConfig.isTelemetryEnabled();
    if (isEnabled) {
      console.log('✅ Telemetry is already enabled');
      const status = await userConfig.getTelemetryStatus();
      console.log(`   User ID: ${status.userId}`);
      console.log(`   Enabled: ${status.consentDate}`);
      return;
    }

    // Get user consent unless force flag is used
    let consent = options.force || false;
    if (!consent) {
      consent = await promptForConsent();
    }

    if (consent) {
      const userId = await userConfig.enableTelemetry();
      console.log('\n✅ Telemetry enabled successfully!');
      console.log(`   User ID: ${userId}`);
      console.log('   Data collected: commands, success/error rates, CLI version, platform');
      console.log('   Data NOT collected: personal info, project names, file contents');
      console.log('\n💡 You can disable telemetry anytime with: specjet telemetry disable');
    } else {
      console.log('\n❌ Telemetry not enabled');
      console.log('   You can enable it later with: specjet telemetry enable');
    }
  } catch (error) {
    ErrorHandler.handle(error, options);
    process.exit(1);
  }
}

/**
 * Disable telemetry tracking
 */
async function disableTelemetry(options = {}) {
  try {
    // Check if already disabled
    const isEnabled = await userConfig.isTelemetryEnabled();
    if (!isEnabled) {
      console.log('ℹ️  Telemetry is already disabled');
      return;
    }

    // Get confirmation unless force flag is used
    let confirmed = options.force || false;
    if (!confirmed) {
      confirmed = await confirmDisable();
    }

    if (confirmed) {
      await userConfig.disableTelemetry();
      console.log('\n✅ Telemetry disabled successfully');
      console.log('   No usage data will be collected');
      console.log('\n💡 You can re-enable telemetry anytime with: specjet telemetry enable');
    } else {
      console.log('\n❌ Telemetry disable cancelled');
    }
  } catch (error) {
    ErrorHandler.handle(error, options);
    process.exit(1);
  }
}

/**
 * Show telemetry status
 */
async function showStatus(options = {}) {
  try {
    const status = await userConfig.getTelemetryStatus();
    const isFirstRun = await userConfig.isFirstRun();

    console.log('\n📊 SpecJet Telemetry Status');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (status.enabled) {
      console.log('Status: ✅ ENABLED');
      console.log(`User ID: ${status.userId}`);
      console.log(`Enabled: ${new Date(status.consentDate).toLocaleDateString()}`);
    } else {
      console.log('Status: ❌ DISABLED');
      if (status.userId) {
        console.log(`User ID: ${status.userId} (preserved for consistency)`);
      }
    }

    console.log(`First Run: ${isFirstRun ? 'Yes (consent prompt will show)' : 'No'}`);
    console.log(`Config: ${status.configPath}`);

    console.log('\n📋 Data Collection Policy');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Commands used (init, generate, mock, etc.)');
    console.log('✅ Success/error rates and types');
    console.log('✅ CLI version and platform (node version, OS)');
    console.log('✅ Command duration and performance metrics');
    console.log('✅ Configuration options (port numbers, scenarios)');
    console.log('');
    console.log('❌ Personal information (names, emails)');
    console.log('❌ Project names or file paths');
    console.log('❌ File contents or API specifications');
    console.log('❌ Environment variables or secrets');

    console.log('\n💡 Commands');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('specjet telemetry enable    Enable anonymous telemetry');
    console.log('specjet telemetry disable   Disable telemetry collection');
    console.log('specjet telemetry status    Show this status information');
  } catch (error) {
    ErrorHandler.handle(error, options);
    process.exit(1);
  }
}

/**
 * Main telemetry management command
 */
async function telemetryCommand(action, options = {}) {
  return ErrorHandler.withErrorHandling(async () => {
    switch (action) {
      case 'enable':
        await enableTelemetry(options);
        break;

      case 'disable':
        await disableTelemetry(options);
        break;

      case 'status':
        await showStatus(options);
        break;

      default:
        throw new SpecJetError(
          `Invalid telemetry action: ${action}`,
          'INVALID_TELEMETRY_ACTION',
          null,
          [
            'Valid actions are: enable, disable, status',
            'Example: specjet telemetry enable',
            'Example: specjet telemetry disable',
            'Example: specjet telemetry status'
          ]
        );
    }
  }, options);
}

export default telemetryCommand;