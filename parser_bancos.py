import re


def extrair_dados_notificacao(texto, banco_informado="Desconhecido"):
    """
    Extrai o valor e o local de notificações do C6 Bank, PicPay ou cartões genéricos.
    """
    if not texto:
        return 0.0, "Texto vazio"

    # 1. Regex para capturar o valor (ex: R$ 45,90 ou R$ 1.250,00)
    match_valor = re.search(r"R\$\s?([\d.,]+)", texto)
    valor = 0.0
    if match_valor:
        # Remove pontos de milhar e substitui vírgula por ponto
        str_valor = match_valor.group(1).replace(".", "").replace(",", ".")
        try:
            valor = float(str_valor)
        except ValueError:
            valor = 0.0

    # 2. Regex para capturar o estabelecimento após preposições (em, no, na, para)
    match_local = re.search(
        r"(?:em|no|na|para)\s+([A-Za-z0-9\s*_-]+?)(?:\s+foi|\s+com|\s+usando|\s+no dia|\s+às|\.|$)",
        texto,
        re.IGNORECASE,
    )

    if match_local:
        local = match_local.group(1).strip()
    else:
        local = "Estabelecimento não identificado"

    return valor, local
