// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyCvNs6gb536b2xbOXJO7D8tHjIrLJdpyVU",
    authDomain: "secuvra-portal.firebaseapp.com",
    projectId: "secuvra-portal",
    storageBucket: "secuvra-portal.firebasestorage.app",
    messagingSenderId: "819757471246",
    appId: "1:819757471246:web:aef3ef4283c9bf22558e5f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
