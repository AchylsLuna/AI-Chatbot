import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../Models/UserModel.js';
import { appConfig } from './env.js';

export const isGoogleAuthEnabled =
  Boolean(appConfig.googleClientId) && Boolean(appConfig.googleClientSecret);

if (isGoogleAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: appConfig.googleClientId,
        clientSecret: appConfig.googleClientSecret,
        callbackURL: '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // 1. Check if user exists by Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            return done(null, user);
          }

          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('Google profile missing email'), null);
          }

          // 2. Check if user exists by Email (Link account)
          user = await User.findOne({ email });

          if (user) {
            // Link the Google ID to the existing email account
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          }

          // 3. Create New User
          // Note: We set a dummy password because schema requires a value for non-local auth.
          user = new User({
            googleId: profile.id,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            email,
            passwordHashed: 'GOOGLE_OAUTH_USER_NO_PASS',
            role: 'user',
            status: 'active',
          });

          await user.save();
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn(
    '[auth] Google OAuth disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.'
  );
}

// Serialization is needed for Passport sessions, though we use custom JWTs.
// We just pass the user object through.
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});
