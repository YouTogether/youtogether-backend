import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  App,
  cert,
  deleteApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Database, getDatabase } from 'firebase-admin/database';

/**
 * Thin wrapper around the Firebase Admin SDK, owning the lifecycle of a
 * single named Firebase application for the whole backend process.
 *
 * Lives outside any bounded context, in a shared infrastructure module,
 * because two contexts need it for unrelated reasons:
 * - Video Synchronisation writes the authoritative `playback_state`
 *   node at session creation ({@link FirebaseRealtimeStateService}).
 * - Authentication mints Firebase custom tokens so that Realtime
 *   Database security rules can authorize writes against `auth.uid`
 *   ({@link FirebaseAuthProviderService}).
 *
 * Placing it under either context would force the other to depend on a
 * bounded context it has no business knowing about.
 *
 * ## Credentials
 * Supplied as three separate environment variables rather than a path
 * to a service-account JSON file: this deploys unchanged to GitHub
 * Actions secrets, Docker environment variables, and a local `.env`,
 * none of which handle a file path well.
 *
 * - `FIREBASE_PROJECT_ID`
 * - `FIREBASE_CLIENT_EMAIL`
 * - `FIREBASE_PRIVATE_KEY`
 * - `FIREBASE_DATABASE_URL`
 *
 * All four are read with `getOrThrow`, so a misconfigured deployment
 * fails at boot rather than at the first write. The private key is a
 * first-order secret: it bypasses every Realtime Database security
 * rule, and it signs the custom tokens that establish user identity. It
 * is never logged, and the service-account JSON it came from must never
 * be committed.
 *
 * ## Named application
 * The SDK is initialized under an explicit application name rather than
 * as the default app. Integration tests that bootstrap several Nest
 * testing modules in the same Jest worker would otherwise collide on
 * the default app's global registry, and {@link onModuleDestroy} would
 * tear down an app another suite is still using.
 *
 * @competency Secure handling of external credentials (OWASP A05:2021)
 */
@Injectable()
export class FirebaseAdminService implements OnModuleInit, OnModuleDestroy {
  /** Registry name for this process's Firebase application. */
  private static readonly APP_NAME = 'youtogether-admin';

  private readonly logger = new Logger(FirebaseAdminService.name);

  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initializes the Firebase application, or adopts an already
   * registered one of the same name.
   *
   * @throws {Error} if any required environment variable is absent
   *   (propagated from `ConfigService.getOrThrow`), failing the boot.
   */
  onModuleInit(): void {
    const existing = getApps().find(
      (app) => app.name === FirebaseAdminService.APP_NAME,
    );

    if (existing !== undefined) {
      this.app = existing;
      return;
    }

    const projectId = this.configService.getOrThrow<string>(
      'FIREBASE_PROJECT_ID',
    );
    const clientEmail = this.configService.getOrThrow<string>(
      'FIREBASE_CLIENT_EMAIL',
    );
    const privateKey = FirebaseAdminService.normalisePrivateKey(
      this.configService.getOrThrow<string>('FIREBASE_PRIVATE_KEY'),
    );
    const databaseURL = this.configService.getOrThrow<string>(
      'FIREBASE_DATABASE_URL',
    );

    this.app = initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
        databaseURL,
      },
      FirebaseAdminService.APP_NAME,
    );

    // Deliberately logs the project id only. The client email and
    // private key never reach the logs.
    this.logger.log(`Firebase Admin initialised for project "${projectId}".`);
  }

  /**
   * Releases the Firebase application and its open Realtime Database
   * connection.
   *
   * Without this, the SDK's background socket keeps the Node event loop
   * alive and Jest reports "a worker process has failed to exit
   * gracefully" after every integration suite.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.app === null) {
      return;
    }

    await deleteApp(this.app);
    this.app = null;
  }

  /**
   * The Realtime Database handle for the initialised application.
   *
   * Writes made through this handle run with administrative privileges
   * and **bypass every security rule**. That is exactly why the
   * `playback_state` node is written here rather than by a client: it
   * lets the rules forbid clients from ever creating that node, closing
   * the "first writer claims leadership" hole a client-side
   * initialisation would leave open.
   *
   * @throws {Error} if accessed before {@link onModuleInit} has run.
   */
  get database(): Database {
    return getDatabase(this.requireApp());
  }

  /**
   * The Firebase Authentication handle for the initialized application.
   *
   * Used for exactly one operation, `createCustomToken` — see
   * {@link IFirebaseAuthProvider} for why the backend asserts identities
   * to Firebase without ever reading them back from it.
   *
   * @throws {Error} if accessed before {@link onModuleInit} has run.
   */
  get auth(): Auth {
    return getAuth(this.requireApp());
  }

  private requireApp(): App {
    if (this.app === null) {
      throw new Error(
        'FirebaseAdminService was used before onModuleInit() completed.',
      );
    }

    return this.app;
  }

  /**
   * Restores real newlines in a PEM private key supplied through an
   * environment variable.
   *
   * `.env` files, Docker `-e` flags and GitHub Actions secrets all
   * carry the key as a single line with literal `\n` sequences. Passing
   * that string to `cert()` unchanged produces an opaque
   * "Failed to parse private key" error at boot.
   */
  private static normalisePrivateKey(raw: string): string {
    return raw.replace(/\\n/g, '\n');
  }
}
