import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FirebaseAdminService } from './firebase-admin.service';

/**
 * Shared infrastructure module exposing {@link FirebaseAdminService}.
 *
 * Not a bounded context: it holds no domain logic, no entities and no
 * use cases. It exists so that several bounded contexts can share a
 * single Firebase application instance without depending on one
 * another — {@link VideoSyncModule} imports it today,
 * {@link AuthModule} will import it for custom token issuance (B-A06).
 *
 * Deliberately not declared `@Global()`: an implicit global provider
 * would hide which contexts actually reach out to Firebase, and that
 * information matters when reasoning about the security perimeter.
 * Each consumer imports it explicitly.
 *
 * @see FirebaseAdminService — required environment variables
 */
@Module({
  imports: [ConfigModule],
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseModule {}
