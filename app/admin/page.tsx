'use client'

import React, { useState } from "react";

//TODO: ABSICHERN!!! Nur für Entwicklung und Debugging!

const CreateUserPage: React.FC = () => {

  const api_url = process.env.NEXT_PUBLIC_API_URL;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setStatus("loading");

    try {
      const res = await fetch(`${api_url}/users/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.status === 201) {
        setStatus("success");
        setMessage("User successfully created.");
        setUsername("");
        setPassword("");
      } else if (res.status === 409) {
        setStatus("error");
        setMessage("Username already taken.");
      } else {

        const data = await res.json();
        if (Array.isArray(data.detail)) {
          setMessage(data.detail.map((d) => d.msg).join(" | "));
        } else {
          setMessage(data.detail || "Unknown error");
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage("unknown error");
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm("Are you sure?")) return;

    try {
      const res = await fetch(`${api_url}/admin/full-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (res.ok) {
        alert("db reset successful");
      } else {
        alert("Error: " + data.detail);
      }
    } catch (error) {
      alert("Unknown error: " + error);
    }
  };


  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-xl shadow-xl">
    <h1 className="text-xl font-semibold mb-4">Create New User</h1>
    <form onSubmit={handleSubmit} className="space-y-4">
        <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="w-full border px-3 py-2 rounded"
        required
        />
        <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full border px-3 py-2 rounded"
        required
        />
        <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
        {status === "loading" ? "Creating..." : "Create User"}
        </button>
    </form>
    {status !== "idle" && (
        <p className={`mt-4 ${status === "success" ? "text-green-600" : "text-red-600"}`}>
        {message}
        </p>
    )}

    <hr className="my-6" />

    <button
      onClick={handleResetDatabase}
      className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
    >
      RESET DATABASE STRUCTURE
    </button>

    </div>

  );
};

export default CreateUserPage;
