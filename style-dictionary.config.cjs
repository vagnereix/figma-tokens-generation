const StyleDictionary = require('style-dictionary');

const DEFAULT_INDENTATION = '  ';
const CSS_PREFIXES_TO_STRIP = [
  'primitives-default-',
  'primitives-brand-',
  'semantic-colors-',
  'semantic-colors-',
  'semantic-colors-',
];

function isColorToken(token) {
  const directType = token.type;
  const attributeType = token.attributes?.type;
  const category = token.attributes?.category;

  return (
    directType === 'color' ||
    attributeType === 'color' ||
    category === 'color'
  );
}

function findReferencedToken(token, dictionary, seen = new Set()) {
  if (!dictionary.usesReference(token)) {
    return null;
  }

  const [reference] = dictionary.getReferences(token);
  if (!reference) {
    return null;
  }

  if (seen.has(reference.name)) {
    return reference;
  }

  if (!dictionary.usesReference(reference)) {
    return reference;
  }

  seen.add(reference.name);
  return findReferencedToken(reference, dictionary, seen) || reference;
}

function formatColorValue(token, dictionary) {
  const referencedToken = findReferencedToken(token, dictionary);

  if (referencedToken) {
    return `var(--${formatCssVariableName(referencedToken.name)})`;
  }

  return `${token.value}`;
}

function formatCssVariableName(originalName) {
  let name = originalName;

  CSS_PREFIXES_TO_STRIP.forEach((prefix) => {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
    }
  });

  return name;
}

function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const matched = value.match(/-?\d*\.?\d+/);
    if (matched) {
      return Number.parseFloat(matched[0]);
    }
  }

  return Number.NaN;
}

function trimNumber(value, precision = 4) {
  return Number.parseFloat(value.toFixed(precision)).toString();
}

function toRem(value) {
  const numeric = toNumber(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric === 0) {
    return '0';
  }

  return `${trimNumber(numeric / 16)}rem`;
}

function toPx(value) {
  const numeric = toNumber(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric === 0) {
    return '0px';
  }

  return `${trimNumber(numeric)}px`;
}

function formatObjectToJs(object, indentLevel = 0) {
  const entries = Object.entries(object);

  if (entries.length === 0) {
    return '{}';
  }

  const indent = '  '.repeat(indentLevel);
  const nextIndent = '  '.repeat(indentLevel + 1);

  const lines = ['{'];

  entries.forEach(([key, value], index) => {
    const isIdentifier = /^[a-zA-Z_$][\w$]*$/.test(key);
    const formattedKey = isIdentifier
      ? key
      : `'${key.replace(/'/g, "\\'")}'`;

    let formattedValue;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      formattedValue = formatObjectToJs(value, indentLevel + 1);
    } else if (typeof value === 'string') {
      formattedValue = `'${value.replace(/'/g, "\\'")}'`;
    } else {
      formattedValue = `${value}`;
    }

    const comma = index === entries.length - 1 ? '' : ',';

    lines.push(`${nextIndent}${formattedKey}: ${formattedValue}${comma}`);
  });

  lines.push(`${indent}}`);

  return lines.join('\n');
}

function isFontStyleToken(token) {
  const value = token.value;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(value, 'fontFamily') &&
    Object.prototype.hasOwnProperty.call(value, 'fontSize') &&
    Object.prototype.hasOwnProperty.call(value, 'fontWeight')
  );
}

function createFontUtility(token) {
  const value = token.value || {};
  const utility = {};

  if (value.fontFamily) {
    utility.fontFamily = String(value.fontFamily);
  }

  if (value.fontWeight !== undefined && value.fontWeight !== null) {
    utility.fontWeight = String(value.fontWeight);
  }

  if (value.fontSize !== undefined && value.fontSize !== null) {
    const rem = toRem(value.fontSize);
    if (rem !== null) {
      utility.fontSize = rem;
    }
  }

  if (value.letterSpacing !== undefined && value.letterSpacing !== null) {
    const px = toPx(value.letterSpacing);
    if (px !== null) {
      utility.letterSpacing = px;
    }
  }

  return utility;
}

function isGridToken(token) {
  const value = token.value;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(value, 'pattern') &&
    Object.prototype.hasOwnProperty.call(value, 'gutterSize')
  );
}

function createGridUtility(token) {
  const value = token.value || {};
  const utility = { display: 'grid' };

  const gap = toRem(value.gutterSize);
  const offset = toRem(value.offset);

  if (value.pattern === 'columns') {
    if (value.count) {
      utility.gridTemplateColumns = `repeat(${value.count}, minmax(0, 1fr))`;
    }

    if (gap !== null) {
      utility.columnGap = gap;
    }
  }

  if (value.pattern === 'rows') {
    if (value.count) {
      utility.gridTemplateRows = `repeat(${value.count}, minmax(0, 1fr))`;
    }

    if (gap !== null) {
      utility.rowGap = gap;
    }
  }

  if (offset !== null) {
    utility.paddingInline = offset;
  }

  if (value.alignment) {
    utility.alignItems = value.alignment;
    utility.justifyItems = value.alignment;
  }

  return Object.fromEntries(
    Object.entries(utility).filter(([, val]) => val !== undefined && val !== null),
  );
}

function toClassSelector(token) {
  const baseName = token.name || (token.path || []).join('-');

  const normalized = baseName
    .toString()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  return `.${normalized}`;
}

StyleDictionary.registerFormat({
  name: 'custom/css-variables',
  formatter({ dictionary, file, options = {} }) {
    const selector = options.selector || ':root';
    const indentation = options.indentation || DEFAULT_INDENTATION;
    const tokens = dictionary.allTokens.filter(isColorToken);
    const header = [
      '/**',
      ' * Do not edit directly',
      ` * Generated on ${new Date().toUTCString()}`,
      ' */',
      '',
      `${selector} {`,
    ];

    const body = [];
    let lastPrefix = null;

    tokens.forEach((token) => {
      const variableName = formatCssVariableName(token.name);
      const [currentPrefix] = variableName.split('-');

      if (lastPrefix !== null && currentPrefix !== lastPrefix) {
        body.push('');
      }

      body.push(
        `${indentation}--${variableName}: ${formatColorValue(token, dictionary)};`,
      );

      lastPrefix = currentPrefix;
    });

    return [...header, ...body, '}'].join('\n');
  },
});

StyleDictionary.registerFormat({
  name: 'custom/tailwind-utilities',
  formatter({ dictionary }) {
    const utilities = {};

    dictionary.allTokens.forEach((token) => {
      if (isFontStyleToken(token)) {
        const utility = createFontUtility(token);
        if (Object.keys(utility).length > 0) {
          utilities[toClassSelector(token)] = utility;
        }
        return;
      }

      if (isGridToken(token)) {
        const utility = createGridUtility(token);
        if (Object.keys(utility).length > 0) {
          utilities[toClassSelector(token)] = utility;
        }
      }
    });

    const header = [
      '/**',
      ' * Do not edit directly',
      ` * Generated on ${new Date().toUTCString()}`,
      ' */',
    ];

    const formattedUtilities = formatObjectToJs(utilities);

    return [...header, `export const tokensUtilities = ${formattedUtilities};`, ''].join('\n');
  },
});

module.exports = {
  source: ['input/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'tokens-css-variables.css',
          format: 'custom/css-variables',
          options: {
            selector: ':root',
            indentation: DEFAULT_INDENTATION,
          },
        },
      ],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'build/js/',
      files: [
        {
          destination: 'tokens-tailwind-utilities.js',
          format: 'custom/tailwind-utilities',
        },
      ],
    },
  },
};

