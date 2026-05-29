"use client";

import { useState } from"react";
import { Share2, Check, Link as LinkIcon } from"lucide-react";
import { toast } from"sonner";

interface Props {
  token: string | null;
  profileId: string;
}

export function ShareProfileButton({ token, profileId }: Props) {
  const [copied, setCopied] = useState(false);

  function getShareUrl() {
    return `${window.location.origin}/share/${token}`;
  }

  async function handleShare() {
    if (!token) {
      toast.error("Este perfil no tiene link de compartir");
      return;
    }

    const url = getShareUrl();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado al portapapeles");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para browsers que no soportan clipboard API
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleNativeShare() {
    if (!token || !navigator.share) return;
    try {
      await navigator.share({
        title:"Perfil de tueste",
        text:"Mirá este perfil de tueste en Primer crack OS",
        url: getShareUrl(),
      });
    } catch {
      // El usuario canceló el share
    }
  }

  return (<div className="flex gap-1">
      <button
        onClick={handleShare}
        className={`btn-secondary text-xs flex items-center gap-1.5 transition-colors ${
          copied ?"border-status-success text-status-success bg-green-50" :""
        }`}
        title="Copiar link del perfil"
      >
        {copied
          ? <><Check className="w-3.5 h-3.5" /> Copiado</>
          : <><LinkIcon className="w-3.5 h-3.5" /> Compartir</>
        }
      </button>
    </div>);
}
