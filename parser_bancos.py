import re


def extrair_dados_notificacao(texto, banco_informado="Desconhecido"):
    """
    Extrai o valor e o local/destinatário de notificações do C6 Bank, PicPay,
    compras no cartão, Pix enviados e pagamentos de boletos.
    """
    if not texto:
        return 0.0, "Texto vazio"

    # 1. Extração do Valor (ex: R$ 45,90 ou R$ 1.250,00)
    match_valor = re.search(r"R\$\s?([\d.,]+)", texto)
    valor = 0.0
    if match_valor:
        # Remove pontos de milhar e substitui vírgula por ponto decimal
        str_valor = match_valor.group(1).replace(".", "").replace(",", ".")
        try:
            valor = float(str_valor)
        except ValueError:
            valor = 0.0

    # 2. Extração do Local / Destinatário

    # Caso A: Pix enviado ou transferência ("Pix enviado para...", "transferiu para...", "Pix para...")
    match_pix = re.search(
        r"(?:pix\s+(?:enviado\s+)?(?:para\s+)?|transferiu\s+para\s+|transferência\s+para\s+)(.+?)(?:\s+no\s+valor|\s+de\s+R\$|\s+foi|\s+com|\s+às|\.|$)",
        texto,
        re.IGNORECASE,
    )

    # Caso B: Compras e Pagamentos Padrão (após "em", "no", "na", "para")
    match_local = re.search(
        r"(?:em|no|na|para)\s+([A-Za-z0-9\s*_-]+?)(?:\s+no\s+valor|\s+foi|\s+com|\s+usando|\s+no\s+dia|\s+às|\.|$)",
        texto,
        re.IGNORECASE,
    )

    if match_pix:
        local = match_pix.group(1).strip()
    elif match_local:
        local = match_local.group(1).strip()
    else:
        local = "Estabelecimento não identificado"

    # 3. Limpeza de ruídos comuns no final da string extraída
    palavras_remover = [
        r"^o\s+",
        r"^a\s+",
        r"^seu\s+",
        r"^sua\s+",
        r"\s+no\s+valor.*$",
        r"\s+de\s+R\$.*$",
        r"\s+com\s+sucesso.*$",
    ]
    for pattern in palavras_remover:
        local = re.sub(pattern, "", local, flags=re.IGNORECASE).strip()

    return valor, local
