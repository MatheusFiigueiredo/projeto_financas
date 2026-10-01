from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request
from flask_sqlalchemy import SQLAlchemy
from openpyxl import load_workbook

from parser_bancos import extrair_dados_notificacao

app = Flask(__name__)

# Configuração do Banco de Dados SQLite local
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///financas.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# --- CAMINHO DA SUA PLANILHA NO ONEDRIVE ---
CAMINHO_EXCEL = "financas_onedrive.xlsx"


# Função de auxílio para categorização automática
def identificar_categoria(local):
    local_upper = (local or "").upper()

    if "GUARIROBA" in local_upper or "AGUAS" in local_upper:
        return "Água"
    elif "ENERGISA" in local_upper:
        return "Luz"
    elif "CONDOMINIO" in local_upper:
        return "Condomínio"
    else:
        return "Outros"


# Modelo do Banco SQL local
class Transacao(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    banco = db.Column(db.String(50))
    valor = db.Column(db.Float, nullable=False)
    local = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(50), default="Outros")
    data_hora = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "banco": self.banco,
            "valor": self.valor,
            "local": self.local,
            "categoria": self.categoria,
            "data_hora": self.data_hora.strftime("%d/%m/%Y %H:%M:%S"),
        }


with app.app_context():
    db.create_all()


MESES_PT = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Março",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro",
}


def salvar_no_excel_onedrive(banco, valor, local, data_hora_obj):
    """
    Insere a transação exatamente na estrutura da planilha do cartão.
    """
    try:
        wb = load_workbook(CAMINHO_EXCEL)

        # 1. Identifica a aba correspondente ao mês atual
        nome_aba = MESES_PT[data_hora_obj.month]

        if nome_aba in wb.sheetnames:
            ws = wb[nome_aba]
        else:
            ws = wb.active

        # 2. Formatações de valores
        data_formatada = data_hora_obj.strftime("%d/%b").lower()  # Ex: 01/out
        detalhamento = local
        parcela = ""
        forma_pagamento = banco

        # 3. Encontra a próxima linha vazia a partir da linha 3
        proxima_linha = 3
        while ws[f"B{proxima_linha}"].value is not None:
            proxima_linha += 1

        # 4. Preenche as células nas colunas A até F
        ws[f"A{proxima_linha}"] = data_formatada
        ws[f"B{proxima_linha}"] = local
        ws[f"C{proxima_linha}"] = detalhamento
        ws[f"D{proxima_linha}"] = parcela
        ws[f"E{proxima_linha}"] = forma_pagamento
        ws[f"F{proxima_linha}"] = valor

        wb.save(CAMINHO_EXCEL)
        print(
            f"[OneDrive] Inserido na aba '{nome_aba}', linha {proxima_linha}: R$ {valor} no {banco}"
        )

    except (OSError, FileNotFoundError, PermissionError) as e:
        print(f"[Erro OneDrive] Falha ao escrever na planilha: {e}")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == "GET":
        texto = request.args.get("texto", "")
        banco = request.args.get("banco", "C6/PicPay")
    else:
        dados = request.get_json() or {}
        texto = dados.get("texto", "")
        banco = dados.get("banco", "C6/PicPay")

    if not texto:
        return jsonify({"erro": "Nenhum texto informado"}), 400

    # Extrai o valor e local usando seu parser existente
    valor, local = extrair_dados_notificacao(texto, banco)

    # Classifica se é Água (Guariroba), Luz (Energisa), etc.
    categoria = identificar_categoria(local)

    data_hora_atual = datetime.now(timezone.utc)

    # 1. Salva no banco SQLite local para o Dashboard web
    nova_transacao = Transacao(
        banco=banco,
        valor=valor,
        local=local,
        categoria=categoria,
        data_hora=data_hora_atual,
    )
    db.session.add(nova_transacao)
    db.session.commit()

    # 2. Insere a nova linha na planilha do OneDrive
    salvar_no_excel_onedrive(banco, valor, local, data_hora_atual)

    return jsonify({"status": "sucesso", "transacao": nova_transacao.to_dict()}), 201


@app.route("/api/transacoes", methods=["GET"])
def listar_transacoes():
    mes_atual = datetime.now().strftime("%m")
    mes = request.args.get("mes", mes_atual)

    transacoes = Transacao.query.all()
    transacoes_filtradas = [
        t.to_dict()
        for t in transacoes
        if t.data_hora.strftime("%m") == str(mes).zfill(2)
    ]

    return jsonify(transacoes_filtradas)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
