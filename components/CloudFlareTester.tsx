"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EyeIcon, EyeOffIcon, Check, X, LoaderCircle } from "lucide-react";

export type CloudflareR2TesterProps = {
  initialAccountId?: string;
  initialAccessKeyId?: string;
  initialSecretAccessKey?: string;
  initialBucket?: string;
  onValidatedChange?: (v: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    allValid: boolean;
  }) => void;
  apiPath?: string;
  regionHost?: string;
  debounceMs?: number;
};

export default function CloudflareR2Tester({
  initialAccountId = "",
  initialAccessKeyId = "",
  initialSecretAccessKey = "",
  initialBucket = "",
  onValidatedChange,
  apiPath = `${process.env.NEXT_PUBLIC_API_URL}/cloudflare/test`,
  regionHost,
  debounceMs = 400,
}: CloudflareR2TesterProps) {
  const [accountId, setAccountId] = useState(initialAccountId);
  const [accessKeyId, setAccessKeyId] = useState(initialAccessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState(initialSecretAccessKey);
  const [bucket, setBucket] = useState(initialBucket);

  const [showAccountId, setShowAccountId] = useState(true);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showBucket, setShowBucket] = useState(true);

  const [testingAccount, setTestingAccount] = useState(false);
  const [testingCreds, setTestingCreds] = useState(false);
  const [testingBucket, setTestingBucket] = useState(false);

  const [okAccount, setOkAccount] = useState<boolean | undefined>(undefined);
  const [okCreds, setOkCreds] = useState<boolean | undefined>(undefined);
  const [okBucket, setOkBucket] = useState<boolean | undefined>(undefined);

  const accountTimer = useRef<NodeJS.Timeout | null>(null);
  const credsTimer = useRef<NodeJS.Timeout | null>(null);
  const bucketTimer = useRef<NodeJS.Timeout | null>(null);

  const Icon = ({ ok, spinning }: { ok?: boolean; spinning?: boolean }) =>
    spinning ? (
      <LoaderCircle className="size-4 animate-spin" />
    ) : ok === undefined ? null : ok ? (
      <Check className="size-4 text-green-600" />
    ) : (
      <X className="size-4 text-red-500" />
    );

  const emitChange = (next?: {
    okAccount?: boolean;
    okCreds?: boolean;
    okBucket?: boolean;
  }) => {
    const a = next?.okAccount ?? okAccount;
    const c = next?.okCreds ?? okCreds;
    const b = next?.okBucket ?? okBucket;
    onValidatedChange?.({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      allValid: !!(a && c && b),
    });
  };

  const post = async (body: any) => {
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regionHost ? { ...body, regionHost } : body),
    });
    if (!res.ok) throw new Error("request_failed");
    return res.json();
  };

  useEffect(() => {
    if (accountTimer.current) clearTimeout(accountTimer.current);
    if (!accountId) {
      setOkAccount(undefined);
      emitChange({ okAccount: undefined });
      return;
    }
    accountTimer.current = setTimeout(async () => {
      setTestingAccount(true);
      try {
        const json = await post({ test: "accountId", accountId });
        const ok = !!json.ok;
        setOkAccount(ok);
        emitChange({ okAccount: ok });
      } catch {
        setOkAccount(false);
        emitChange({ okAccount: false });
      } finally {
        setTestingAccount(false);
      }
    }, debounceMs);
    return () => {
      if (accountTimer.current) clearTimeout(accountTimer.current);
    };
  }, [accountId]);

  useEffect(() => {
    if (credsTimer.current) clearTimeout(credsTimer.current);

    if (!accountId || !accessKeyId || !secretAccessKey) {
      setOkCreds(undefined);
      emitChange({ okCreds: undefined });
      return;
    }
    if (okAccount === false) {
      setOkCreds(undefined);
      emitChange({ okCreds: undefined });
      return;
    }

    credsTimer.current = setTimeout(async () => {
      setTestingCreds(true);
      try {
        const payload: any = {
          test: "credentials",
          accountId,
          accessKeyId,
          secretAccessKey,
        };
        if (bucket) payload.bucket = bucket;

        const json = await post(payload);
        const ok = !!json.ok;
        setOkCreds(ok);
        emitChange({ okCreds: ok });
      } catch {
        setOkCreds(false);
        emitChange({ okCreds: false });
      } finally {
        setTestingCreds(false);
      }
    }, debounceMs);

    return () => {
      if (credsTimer.current) clearTimeout(credsTimer.current);
    };
  }, [secretAccessKey, accountId, accessKeyId, okAccount, bucket]);

  useEffect(() => {
    if (bucketTimer.current) clearTimeout(bucketTimer.current);
    if (!bucket) {
      setOkBucket(undefined);
      emitChange({ okBucket: undefined });
      return;
    }
    if (okCreds !== true) {
      setOkBucket(undefined);
      emitChange({ okBucket: undefined });
      return;
    }

    bucketTimer.current = setTimeout(async () => {
      setTestingBucket(true);
      try {
        const json = await post({
          test: "bucket",
          accountId,
          accessKeyId,
          secretAccessKey,
          bucket,
        });
        const ok = !!json.ok;
        setOkBucket(ok);
        emitChange({ okBucket: ok });
      } catch {
        setOkBucket(false);
        emitChange({ okBucket: false });
      } finally {
        setTestingBucket(false);
      }
    }, debounceMs);

    return () => {
      if (bucketTimer.current) clearTimeout(bucketTimer.current);
    };
  }, [bucket, okCreds, accountId, accessKeyId, secretAccessKey]);

  return (
    <Card className="border-gray-200">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={accountId}
            type={showAccountId ? "text" : "password"}
            placeholder="R2_ACCOUNT_ID"
            onChange={(e) => setAccountId(e.target.value)}
          />
          {showAccountId ? (
            <EyeOffIcon
              onClick={() => setShowAccountId(false)}
              className="cursor-pointer shrink-0"
            />
          ) : (
            <EyeIcon
              onClick={() => setShowAccountId(true)}
              className="cursor-pointer shrink-0"
            />
          )}
          <Icon ok={okAccount} spinning={testingAccount} />
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={accessKeyId}
            type={showAccessKey ? "text" : "password"}
            placeholder="R2_ACCESS_KEY_ID"
            onChange={(e) => setAccessKeyId(e.target.value)}
          />
          {showAccessKey ? (
            <EyeOffIcon
              onClick={() => setShowAccessKey(false)}
              className="cursor-pointer shrink-0"
            />
          ) : (
            <EyeIcon
              onClick={() => setShowAccessKey(true)}
              className="cursor-pointer shrink-0"
            />
          )}
          <Icon ok={okCreds} spinning={testingCreds} />
        </div>

        <div className="flex items-center gap-2">
        <Input
            value={secretAccessKey}
            type={showSecret ? "text" : "password"}
            placeholder="R2_SECRET_ACCESS_KEY"
            onChange={(e) => setSecretAccessKey(e.target.value)}
        />
        {showSecret ? (
            <EyeOffIcon
            onClick={() => setShowSecret(false)}
            className="cursor-pointer shrink-0"
            />
        ) : (
            <EyeIcon
            onClick={() => setShowSecret(true)}
            className="cursor-pointer shrink-0"
            />
        )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={bucket}
            type={showBucket ? "text" : "password"}
            placeholder="R2_BUCKET"
            onChange={(e) => setBucket(e.target.value)}
          />
          {showBucket ? (
            <EyeOffIcon
              onClick={() => setShowBucket(false)}
              className="cursor-pointer shrink-0"
            />
          ) : (
            <EyeIcon
              onClick={() => setShowBucket(true)}
              className="cursor-pointer shrink-0"
            />
          )}
          <Icon ok={okBucket} spinning={testingBucket} />
        </div>
      </CardContent>
    </Card>
  );
}
