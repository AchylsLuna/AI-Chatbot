import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../Models/UserModel.js';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        // 1. Check if user exists by Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            return done(null, user);
        }

        // 2. Check if user exists by Email (Link account)
        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
            // Link the Google ID to the existing email account
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
        }

        // 3. Create New User
        user = new User({
            googleId: profile.id,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            email: profile.emails[0].value,
            passwordHashed: "GOOGLE_OAUTH_USER_NO_PASS", 
            role: "user",
            status: "active"
        });
        
        await user.save();
        return done(null, user);

    } catch (err) {
        return done(err, null);
    }
  }
));

// Serialization is needed for Passport sessions, though we use custom JWTs.
// We just pass the user object through.
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});