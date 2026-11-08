// Render the same literal + client-variable text fragments as the five native HTML components.
export function componentHtml(client, component) {
  return component.properties.code.valueBinding.map(part => {
    if (part.kind === 'literal' && typeof part.value === 'string') return part.value;
    const path = part.pathComponents ?? [];
    if (part.kind === 'variable' && path.length === 2 && path[0].name === 'global-data') {
      const variable = client.configuration.globalVariableTable[path[1].name];
      const parts = variable?.defaultValue?.valueBinding;
      if (variable?.displayName === 'workbench_origin' && parts?.length === 1 && parts[0].kind === 'literal') {
        const value = parts[0].value;
        const origin = new URL(value);
        if (origin.protocol === 'https:' && origin.origin === value) return value;
      }
    }
    throw Error('Unrecognized HTML binding on ' + component.id);
  }).join('');
}

export function embeddedDocument(html) {
  const frame = html.match(/src=["']data:text\/html(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)(?:#[^"']*)?["']/i);
  return frame ? Buffer.from(frame[1], 'base64') : null;
}
