# TODO — Make permissions DB-driven & fix bugs

- [x] 1. Backend: attach role's DB permissions to user responses (auth.controller.js)
- [x] 2. Frontend: rewrite src/lib/permissions.js to be DB-driven + fix 'view'-grants-all bug
- [x] 3. Fix call sites: LoginPage passes user.permissions
- [x] 4. Fix call sites: UserManagementView passes currentUser.permissions
- [ ] 5. Verify & smoke test (re-login, sidebar/route/action gating)
