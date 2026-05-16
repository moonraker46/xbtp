const prompts = require('prompts');

function onCancel() {
  throw new Error('Cancelled');
}

const required = (msg) => (v) => (v && v.trim().length > 0) || msg;

const NONE = '__NONE__';
const MANUAL = '__MANUAL__';

async function askCredentials(label, defaults = {}) {
  const userHint = label === 'btp' ? 'SAP S-User' : 'email';
  const answers = await prompts(
    [
      {
        type: 'text',
        name: 'username',
        message: `${label} username (${userHint})`,
        initial: defaults.username || '',
        validate: required('Username required'),
      },
      {
        type: 'password',
        name: 'password',
        message: `${label} password`,
        validate: required('Password required'),
      },
    ],
    { onCancel },
  );
  return answers;
}

async function askCfBasics(defaults = {}, globalDefaults = null, lastApi = '') {
  const hasGlobal = !!(globalDefaults && globalDefaults.username && globalDefaults.password);
  const profileHasOwn = !!(defaults.username && defaults.password);
  const list = [];

  list.push({
    type: 'text',
    name: 'api',
    message: 'CF API endpoint',
    initial: defaults.api || lastApi || 'https://api.cf.eu10.hana.ondemand.com',
    validate: required('API endpoint required'),
  });

  list.push({
    type: 'toggle',
    name: 'skipSslValidation',
    message: 'Skip SSL validation?',
    initial: defaults.skipSslValidation || false,
    active: 'yes',
    inactive: 'no',
  });

  if (hasGlobal) {
    list.push({
      type: 'confirm',
      name: 'useGlobalCreds',
      message: `Use stored default credentials (${globalDefaults.username})?`,
      initial: !profileHasOwn,
    });
    list.push({
      type: (prev) => (prev ? null : 'text'),
      name: 'username',
      message: 'Username (email)',
      initial: defaults.username || '',
      validate: required('Username required'),
    });
    list.push({
      type: (_prev, values) => (values.useGlobalCreds ? null : 'password'),
      name: 'password',
      message: 'Password',
      validate: required('Password required'),
    });
  } else {
    list.push(
      {
        type: 'text',
        name: 'username',
        message: 'Username (email)',
        initial: defaults.username || '',
        validate: required('Username required'),
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password',
        validate: required('Password required'),
      },
    );
  }

  const answers = await prompts(list, { onCancel });

  if (hasGlobal && answers.useGlobalCreds) {
    delete answers.username;
    delete answers.password;
  }
  delete answers.useGlobalCreds;
  return answers;
}

async function askBtpProfile(defaults = {}, globalDefaults = null, lastUrl = '') {
  const hasGlobal = !!(globalDefaults && globalDefaults.username && globalDefaults.password);
  const profileHasOwn = !!(defaults.username && defaults.password);
  const list = [];

  list.push(
    {
      type: 'text',
      name: 'url',
      message: 'BTP CLI URL',
      initial: defaults.url || lastUrl || 'https://cli.btp.cloud.sap',
      validate: required('URL required'),
    },
    {
      type: 'text',
      name: 'subdomain',
      message: 'Subdomain (global account)',
      initial: defaults.subdomain || '',
      validate: required('Subdomain required'),
    },
  );

  if (hasGlobal) {
    list.push({
      type: 'confirm',
      name: 'useGlobalCreds',
      message: `Use stored default credentials (${globalDefaults.username})?`,
      initial: !profileHasOwn,
    });
    list.push({
      type: (prev) => (prev ? null : 'text'),
      name: 'username',
      message: 'Username (SAP S-User)',
      initial: defaults.username || '',
      validate: required('Username required'),
    });
    list.push({
      type: (_prev, values) => (values.useGlobalCreds ? null : 'password'),
      name: 'password',
      message: 'Password',
      validate: required('Password required'),
    });
  } else {
    list.push(
      {
        type: 'text',
        name: 'username',
        message: 'Username (SAP S-User)',
        initial: defaults.username || '',
        validate: required('Username required'),
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password',
        validate: required('Password required'),
      },
    );
  }

  const answers = await prompts(list, { onCancel });

  if (hasGlobal && answers.useGlobalCreds) {
    delete answers.username;
    delete answers.password;
  }
  delete answers.useGlobalCreds;
  return answers;
}

async function pickFromList({ message, items, allowNone = false, initial = '' }) {
  const choices = items.map((item) => ({ title: item, value: item }));
  if (allowNone) choices.push({ title: '— (none, leave empty) —', value: NONE });
  choices.push({ title: '— Enter manually —', value: MANUAL });

  let initialIdx = 0;
  if (initial) {
    const idx = items.indexOf(initial);
    if (idx >= 0) initialIdx = idx;
  }

  const { selected } = await prompts(
    {
      type: 'select',
      name: 'selected',
      message,
      choices,
      initial: initialIdx,
    },
    { onCancel },
  );

  if (selected === NONE) return '';
  if (selected === MANUAL) {
    const { manual } = await prompts(
      {
        type: 'text',
        name: 'manual',
        message: `${message} (manual)`,
        initial: initial || '',
      },
      { onCancel },
    );
    return manual || '';
  }
  return selected;
}

async function askText({ message, initial = '', isRequired = true }) {
  const opts = { type: 'text', name: 'value', message, initial };
  if (isRequired) opts.validate = required(`${message} required`);
  const { value } = await prompts(opts, { onCancel });
  return value || '';
}

async function confirm(message, initial = false) {
  const { ok } = await prompts(
    { type: 'confirm', name: 'ok', message, initial },
    { onCancel },
  );
  return !!ok;
}

module.exports = {
  askCfBasics,
  askBtpProfile,
  askCredentials,
  pickFromList,
  askText,
  confirm,
};
