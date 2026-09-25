import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const instagramCallbackPath = '/api/connections/instagram/callback';

type Environment = Readonly<Record<string, string | undefined>>;

export function resolveTunnelUrl(environment: Environment): string | undefined {
  if (environment.INSTAGRAM_PROVIDER !== 'meta') {
    return undefined;
  }

  const redirectValue = environment.INSTAGRAM_REDIRECT_URI?.trim();

  if (!redirectValue) {
    throw new Error(
      'INSTAGRAM_REDIRECT_URI is required when INSTAGRAM_PROVIDER=meta',
    );
  }

  const redirectUrl = new URL(redirectValue);

  if (redirectUrl.protocol !== 'https:') {
    throw new Error(
      'INSTAGRAM_REDIRECT_URI must use HTTPS for the ngrok tunnel',
    );
  }

  if (
    redirectUrl.pathname !== instagramCallbackPath ||
    redirectUrl.search !== '' ||
    redirectUrl.hash !== ''
  ) {
    throw new Error(
      `INSTAGRAM_REDIRECT_URI must end with ${instagramCallbackPath}`,
    );
  }

  return redirectUrl.origin;
}

export function resolveNgrokCommand(environment: Environment): string {
  const configuredCommand = environment.NGROK_BIN?.trim();

  return configuredCommand === undefined || configuredCommand === ''
    ? 'ngrok'
    : configuredCommand;
}

export async function startDevelopmentTunnel(
  environment: Environment = process.env,
): Promise<number> {
  const tunnelUrl = resolveTunnelUrl(environment);

  if (!tunnelUrl) {
    console.log(
      '[ngrok] skipped because INSTAGRAM_PROVIDER is not set to meta',
    );
    return 0;
  }

  const child = spawn(
    resolveNgrokCommand(environment),
    [
      'http',
      '3000',
      '--url',
      tunnelUrl,
      '--log',
      'stdout',
      '--log-format',
      'json',
    ],
    {
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  const forwardSignal = (signal: NodeJS.Signals): void => {
    child.kill(signal);
  };

  process.once('SIGINT', forwardSignal);
  process.once('SIGTERM', forwardSignal);

  return new Promise((resolve) => {
    child.once('error', (error: Error) => {
      console.error(
        `[ngrok] failed to start (${error.message}). Install ngrok, authenticate it, or set NGROK_BIN.`,
      );
      resolve(1);
    });
    child.once('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

const entrypoint = process.argv[1];

if (
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href
) {
  process.exitCode = await startDevelopmentTunnel();
}
