import { createContext, useContext, useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider 
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'volunteer' or 'admin'
  const [userProfile, setUserProfile] = useState(null); // Full Firestore user doc
  const [loading, setLoading] = useState(true);

  const generatePublicId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  // Sign up
  async function signup(email, password, role, name, mobileNumber, location, ngoName = "", interests = [], coverageLocality = "", pendingNgos = []) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const publicId = generatePublicId();
      
      try {
        // Store user role and additional data in Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          role: role,
          name: name,
          mobileNumber: mobileNumber,
          location: location,
          publicId: publicId,
          ngoName: role === 'admin' ? ngoName : null,
          interests: role === 'admin' ? interests : null,
          coverageLocality: role === 'admin' ? coverageLocality : null,
          resolvedCount: role === 'admin' ? 0 : null,
          volunteerCount: role === 'admin' ? 0 : null,
          assignedTasksCount: role === 'admin' ? 0 : null,
          approvedNgos: role === 'volunteer' ? [] : null,
          pendingNgos: role === 'volunteer' ? pendingNgos : null,
          createdAt: new Date().toISOString()
        });
      } catch (dbError) {
        console.error("Firestore permission error on signup:", dbError);
        alert("Account created, but database access failed. Please check Firestore security rules.");
      }

      setUserRole(role);
      setUserProfile({
          email: user.email,
          role: role,
          name: name,
          mobileNumber: mobileNumber,
          location: location,
          publicId: publicId,
          ngoName: role === 'admin' ? ngoName : null,
          interests: role === 'admin' ? interests : null,
          coverageLocality: role === 'admin' ? coverageLocality : null,
          resolvedCount: role === 'admin' ? 0 : null,
          volunteerCount: role === 'admin' ? 0 : null,
          assignedTasksCount: role === 'admin' ? 0 : null,
          approvedNgos: role === 'volunteer' ? [] : null,
          pendingNgos: role === 'volunteer' ? pendingNgos : null,
      });
      return user;
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  }

  // Log in
  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      try {
        // Fetch role from Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role);
          setUserProfile(docSnap.data());
        } else {
          setUserRole('volunteer'); // Fallback role if not found
          setUserProfile(null);
        }
      } catch (dbError) {
        console.error("Firestore permission error on login:", dbError);
        setUserRole('volunteer'); // Fallback role on permission error
        setUserProfile(null);
        alert("Database access failed. Please check Firestore security rules.");
      }
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  // Log out
  function logout() {
    return signOut(auth);
  }

  // Update Email
  async function updateUserEmail(currentPassword, newEmail) {
    if (!currentUser) throw new Error("No user logged in");
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updateEmail(currentUser, newEmail);
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { email: newEmail });
    setUserProfile(prev => ({ ...prev, email: newEmail }));
  }

  // Update Password
  async function updateUserPassword(currentPassword, newPassword) {
    if (!currentUser) throw new Error("No user logged in");
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role);
            setUserProfile(docSnap.data());
          } else {
            setUserRole('volunteer'); // default fallback
            setUserProfile(null);
          }
        } catch (dbError) {
          console.error("Firestore permission error in auth state:", dbError);
          setUserRole('volunteer'); // default fallback to prevent infinite loop
          setUserProfile(null);
        }
      } else {
        setUserRole(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userProfile,
    login,
    signup,
    logout,
    updateUserEmail,
    updateUserPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
